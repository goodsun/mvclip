import youtubeDl from 'youtube-dl-exec';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createProject, saveProjectFile, updateProjectStatus, updateProjectMetadata } from './projectManager.js';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function downloadVideo(url, options = {}) {
  try {
    // URLの基本検証
    if (!url || !url.includes('youtube.com/watch?v=') && !url.includes('youtu.be/')) {
      throw new Error('無効なYouTube URLです');
    }
    
    console.log('動画情報を取得中...');
    
    // 動画情報を取得
    const info = await youtubeDl(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });
    
    console.log(`📺 動画タイトル: ${info.title}`);
    console.log(`⏱️ 動画時間: ${Math.floor(info.duration / 60)}分${info.duration % 60}秒`);
    
    // 利用可能なフォーマット一覧を取得
    console.log('📋 利用可能なフォーマットを確認中...');
    let formatInfo;
    try {
      // まず基本情報のformatsプロパティを確認
      if (info.formats && info.formats.length > 0) {
        console.log('📊 基本情報からフォーマット取得');
        formatInfo = { formats: info.formats };
      } else {
        console.log('📊 フォーマット詳細を別途取得');
        formatInfo = await youtubeDl(url, {
          dumpSingleJson: true,
          noCheckCertificates: true,
          noWarnings: true,
          addHeader: [
            'referer:youtube.com',
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          ]
        });
      }
      console.log('✅ フォーマット情報取得成功');
    } catch (error) {
      console.error('❌ フォーマット情報取得エラー:', error.message);
      throw new Error(`フォーマット情報の取得に失敗しました: ${error.message}`);
    }
    
    // フォーマット情報をフロントエンドに返却
    if (options.listOnly) {
      console.log('📊 フォーマット情報を処理中...');
      console.log(`総フォーマット数: ${formatInfo.formats?.length || 0}`);
      
      if (!formatInfo.formats || formatInfo.formats.length === 0) {
        console.log('⚠️ フォーマットが見つかりません');
        return {
          videoId: info.id,
          title: info.title,
          duration: info.duration,
          availableFormats: []
        };
      }
      
      // MP4フォーマットをフィルタリング
      const allMp4 = formatInfo.formats.filter(f => f.ext === 'mp4');
      console.log(`MP4フォーマット数: ${allMp4.length}`);
      
      const videoMp4 = allMp4.filter(f => f.height && f.vcodec !== 'none');
      console.log(`映像付きMP4フォーマット数: ${videoMp4.length}`);
      
      const mp4Formats = videoMp4
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .map(fmt => {
          console.log(`フォーマット: ${fmt.format_id}, ${fmt.height}p, ${fmt.vcodec}`);
          return {
            format_id: fmt.format_id,
            height: fmt.height,
            fps: fmt.fps,
            filesize: fmt.filesize,
            filesizeMB: fmt.filesize ? Math.round(fmt.filesize / 1024 / 1024) : null,
            vcodec: fmt.vcodec,
            acodec: fmt.acodec,
            quality: fmt.quality || 'N/A'
          };
        });
      
      console.log(`✅ 処理完了、利用可能フォーマット: ${mp4Formats.length}個`);
      
      return {
        videoId: info.id,
        title: info.title,
        duration: info.duration,
        availableFormats: mp4Formats
      };
    }
    
    // 保存パス
    const timestamp = Date.now();
    const videoId = info.id;
    const filename = `${videoId}_${timestamp}.%(ext)s`;
    const outputPath = path.join(__dirname, '../../temp', filename);
    
    // tempディレクトリを作成
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // フォーマット指定（format_idが指定されている場合）
    let formatSelector;
    if (options.format_id) {
      formatSelector = options.format_id;
      console.log(`🎯 指定されたフォーマット: ${formatSelector}`);
    } else {
      // デフォルト品質設定
      if (options.purpose === 'editing') {
        console.log('🎬 動画編集用: 最高画質設定を適用');
        // より確実に最高画質を取得する設定
        // 段階的フォールバック設定で確実に最高画質を取得
        formatSelector = [
          'bestvideo[height>=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1080]+bestaudio',
          'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio',
          'best[height>=1080][ext=mp4]/best[height>=720][ext=mp4]',
          'best[ext=mp4]/best'
        ].join('/');
      } else {
        console.log('📝 字幕解析用: 効率重視設定を適用');
        formatSelector = 'worst[height>=360][ext=mp4]/best[height<=480][ext=mp4]';
      }
    }
    
    console.log(`📥 フォーマット選択: ${formatSelector}`);
    console.log('動画をダウンロード中...');
    
    // youtube-dl-execでダウンロード
    const result = await youtubeDl(url, {
      output: outputPath,
      format: formatSelector,
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });
    
    // 実際のファイル名を取得（拡張子が自動的に決まる）
    const actualFilename = `${videoId}_${timestamp}.mp4`;
    const actualPath = path.join(__dirname, '../../temp', actualFilename);
    
    console.log(`✅ ダウンロード完了: ${actualPath}`);
    
    // ダウンロードされたファイルの品質を確認
    try {
      const { stdout } = await execAsync(`ffprobe -v quiet -print_format json -show_streams "${actualPath}"`);
      const probe = JSON.parse(stdout);
      const videoStream = probe.streams.find(s => s.codec_type === 'video');
      
      if (videoStream) {
        console.log(`📊 ダウンロード品質確認:`);
        console.log(`   解像度: ${videoStream.width}x${videoStream.height}`);
        console.log(`   フレームレート: ${eval(videoStream.r_frame_rate || '0/1').toFixed(2)}fps`);
        console.log(`   コーデック: ${videoStream.codec_name}`);
        
        const fileSizeInMB = (fs.statSync(actualPath).size / 1024 / 1024).toFixed(1);
        console.log(`   ファイルサイズ: ${fileSizeInMB}MB`);
      }
    } catch (error) {
      console.log('⚠️ 品質確認に失敗:', error.message);
    }
    
    return {
      videoId: info.id,
      title: info.title,
      duration: info.duration,
      filename: actualFilename,
      path: actualPath,
      url: url,
      timeRange: options.startTime || options.endTime ? {
        start: options.startTime || '0:00',
        end: options.endTime || info.duration
      } : null
    };
    
  } catch (error) {
    console.error('youtube-dl-exec ダウンロードエラー:', error);
    throw new Error(`動画のダウンロードに失敗しました: ${error.message}`);
  }
}

// プロジェクト作成用：高画質版ダウンロード + 解析用圧縮コピー
// 高画質版を再ダウンロード
export async function redownloadHighQuality(project) {
  try {
    const { videoId, url } = project;
    console.log(`🔄 高画質版を再ダウンロード: ${videoId}`);
    
    await updateProjectStatus(videoId, 'downloading');
    
    // tempディレクトリを作成
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const highQualityPath = path.join(tempDir, `${videoId}_high_${timestamp}.mp4`);
    
    const highFormatSelector = [
      'bestvideo[height>=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1080]+bestaudio',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio',
      'best[height>=1080][ext=mp4]/best[height>=720][ext=mp4]',
      'best[ext=mp4]/best'
    ].join('/');
    
    await youtubeDl(url, {
      output: highQualityPath,
      format: highFormatSelector,
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });
    
    // プロジェクトに保存
    await saveProjectFile(videoId, 'video_high.mp4', highQualityPath);
    
    // 一時ファイルを削除
    fs.unlinkSync(highQualityPath);
    
    await updateProjectStatus(videoId, 'ready');
    console.log('✅ 高画質版再ダウンロード完了');
    
  } catch (error) {
    console.error('高画質版再ダウンロードエラー:', error);
    await updateProjectStatus(project.videoId, 'error');
    throw error;
  }
}

// 解析用動画を再圧縮
export async function recompressAnalysisVideo(project) {
  try {
    const { videoId, files } = project;
    const highQualityPath = files.highQuality;
    
    if (!highQualityPath || !fs.existsSync(highQualityPath)) {
      throw new Error('高画質版動画が見つかりません');
    }
    
    console.log(`🔄 解析用動画を再圧縮: ${videoId}`);
    
    await updateProjectStatus(videoId, 'processing');
    
    // tempディレクトリを作成
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const analysisPath = path.join(tempDir, `${videoId}_analysis_${timestamp}.mp4`);
    
    // FFmpegで圧縮（480p、低ビットレート、音声認識に十分な品質）
    const ffmpegCmd = `ffmpeg -i "${highQualityPath}" ` +
      `-vf "scale=-2:480" ` +
      `-c:v libx264 -preset fast -crf 28 ` +
      `-c:a aac -b:a 128k -ar 44100 ` +
      `-movflags +faststart ` +
      `-y "${analysisPath}"`;
    
    await execAsync(ffmpegCmd);
    
    // プロジェクトに保存
    await saveProjectFile(videoId, 'video_analysis.mp4', analysisPath);
    
    // 一時ファイルを削除
    fs.unlinkSync(analysisPath);
    
    await updateProjectStatus(videoId, 'ready');
    console.log('✅ 解析用動画再圧縮完了');
    
  } catch (error) {
    console.error('解析用動画再圧縮エラー:', error);
    await updateProjectStatus(project.videoId, 'error');
    throw error;
  }
}

export async function createVideoProject(url, options = {}, progressCallback = null) {
  try {
    // URLの基本検証
    if (!url || !url.includes('youtube.com/watch?v=') && !url.includes('youtu.be/')) {
      throw new Error('無効なYouTube URLです');
    }
    
    console.log('📹 プロジェクト作成開始:', url);
    
    if (progressCallback) {
      progressCallback('info', 10, '動画情報を取得中...');
    }
    
    // 動画情報を取得
    let info;
    try {
      info = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]
      });
    } catch (error) {
      console.error('❗ youtube-dl-execエラー:', error.message);
      // 代替オプションを試す
      console.log('🔄 代替オプションで再試行中...');
      info = await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        skipDownload: true,
        noPlaylist: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]
      });
    }
    
    // デバッグ用に取得した情報をログ出力
    console.log('🔍 取得した情報:', {
      id: info.id || 'N/A',
      title: info.title || 'N/A',
      duration: info.duration || 'N/A',
      width: info.width || 'N/A',
      height: info.height || 'N/A',
      fps: info.fps || 'N/A',
      uploader: info.uploader || 'N/A'
    });
    
    // 必須フィールドの検証
    if (!info.id) {
      throw new Error('動画IDが取得できませんでした');
    }
    
    // タイトルと時間のフォールバック
    const title = info.title || `動画_${info.id}`;
    const duration = info.duration || 0;
    
    console.log(`📺 動画タイトル: ${title}`);
    console.log(`⏱️ 動画時間: ${duration > 0 ? `${Math.floor(duration / 60)}分${duration % 60}秒` : '不明'}`);
    
    // 統一された表示用メタデータを準備（フォールバック付き）
    const metadata = {
      videoId: info.id,
      title: title,
      duration: duration,
      durationText: duration > 0 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '-',
      url: url,
      status: 'creating',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // 表示用の詳細情報（全て統一）
      displayInfo: {
        title: title,
        url: url,
        duration: duration,
        durationText: duration > 0 ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '-',
        videoId: info.id,
        description: info.description || '',
        uploadDate: info.upload_date || null,
        uploader: info.uploader || '-',
        uploaderUrl: info.uploader_url || null,
        viewCount: info.view_count || 0,
        likeCount: info.like_count || 0,
        resolution: (info.width && info.height) ? `${info.width}x${info.height}` : '-',
        fps: info.fps || 0,
        format: info.format || '-',
        filesize: null, // 後で更新
        filesizeText: '-', // 後で更新
        thumbnail: info.thumbnail || null,
        categories: info.categories || [],
        tags: info.tags || [],
        createdAt: new Date().toISOString()
      },
      
      // 後方互換性のため（既存コードが参照する可能性）
      timeRange: null,
      analysisRange: null
    };
    
    if (progressCallback) {
      progressCallback('project', 20, `プロジェクト作成中: ${title}`);
    }
    
    // プロジェクトを作成
    const projectPath = await createProject(info.id, metadata, options.timeRange);
    
    // tempディレクトリを作成
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    
    // 1. 高画質版をダウンロード
    console.log('🎬 高画質版ダウンロード開始...');
    if (progressCallback) {
      progressCallback('download', 30, '🎬 高画質版をダウンロード中...');
    }
    await updateProjectStatus(info.id, 'downloading');
    
    const highQualityPath = path.join(tempDir, `${info.id}_high_${timestamp}.mp4`);
    const highFormatSelector = [
      'bestvideo[height>=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height>=1080]+bestaudio',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio',
      'best[height>=1080][ext=mp4]/best[height>=720][ext=mp4]',
      'best[ext=mp4]/best'
    ].join('/');
    
    await youtubeDl(url, {
      output: highQualityPath,
      format: highFormatSelector,
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    });
    
    console.log('✅ 高画質版ダウンロード完了');
    if (progressCallback) {
      progressCallback('download', 60, '✅ 高画質版ダウンロード完了');
    }
    
    // 高画質版のファイルサイズを取得
    const highQualityStats = fs.statSync(highQualityPath);
    const highQualityFilesize = highQualityStats.size;
    
    // プロジェクトに保存
    await saveProjectFile(info.id, 'video_high.mp4', highQualityPath);
    
    // メタデータを更新（ファイルサイズ情報を追加）
    await updateProjectMetadata(info.id, {
      'displayInfo.filesize': highQualityFilesize,
      'displayInfo.filesizeText': `${(highQualityFilesize / 1024 / 1024).toFixed(1)} MB`
    });
    
    // 2. 高画質版から解析用動画を圧縮生成
    console.log('📝 解析用動画を圧縮生成中...');
    if (progressCallback) {
      progressCallback('compress', 70, '📝 解析用動画を圧縮中...');
    }
    await updateProjectStatus(info.id, 'processing');
    
    const analysisPath = path.join(tempDir, `${info.id}_analysis_${timestamp}.mp4`);
    
    // FFmpegで圧縮（480p、低ビットレート、音声認識に十分な品質）
    const ffmpegCmd = `ffmpeg -i "${highQualityPath}" ` +
      `-vf "scale=-2:480" ` +
      `-c:v libx264 -preset fast -crf 28 ` +
      `-c:a aac -b:a 128k -ar 44100 ` +
      `-movflags +faststart ` +
      `-y "${analysisPath}"`;
    
    await execAsync(ffmpegCmd);
    
    console.log('✅ 解析用動画生成完了');
    if (progressCallback) {
      progressCallback('compress', 90, '✅ 解析用動画圧縮完了');
    }
    
    // プロジェクトに保存
    await saveProjectFile(info.id, 'video_analysis.mp4', analysisPath);
    
    // 一時ファイルを削除
    fs.unlinkSync(highQualityPath);
    fs.unlinkSync(analysisPath);
    
    await updateProjectStatus(info.id, 'ready');
    
    console.log('✅ プロジェクト作成完了');
    
    // ファイルサイズ比較情報を出力
    try {
      const highPath = path.join(projectPath, 'video_high.mp4');
      const analysisPathFinal = path.join(projectPath, 'video_analysis.mp4');
      
      const highSize = (fs.statSync(highPath).size / 1024 / 1024).toFixed(1);
      const analysisSize = (fs.statSync(analysisPathFinal).size / 1024 / 1024).toFixed(1);
      
      console.log(`📊 ファイルサイズ:`);
      console.log(`   高画質版: ${highSize}MB`);
      console.log(`   解析用: ${analysisSize}MB`);
      console.log(`   圧縮率: ${((1 - analysisSize / highSize) * 100).toFixed(1)}%削減`);
    } catch (error) {
      console.log('⚠️ ファイルサイズ確認に失敗:', error.message);
    }
    
    return {
      projectId: info.id,
      videoId: info.id,
      title: info.title,
      duration: info.duration,
      projectPath,
      url: url
    };
    
  } catch (error) {
    console.error('プロジェクト作成エラー:', error);
    throw new Error(`プロジェクトの作成に失敗しました: ${error.message}`);
  }
}