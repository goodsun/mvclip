import express from 'express';
import { createVideoProject } from '../services/youtube.js';
import { createLocalProject } from '../services/localFileProcessor.js';
import { listProjects, getProject, deleteProject, initializeWorkdir, updateAnalysisRange, saveCSVContent, getCSVContent } from '../services/projectManager.js';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

const router = express.Router();

// ローカルファイルアップロード用のmulter設定
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: (req, file, cb) => {
    const videoTypes = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v)$/i;
    const imageTypes = /\.(jpg|jpeg|png|gif|bmp|webp|tiff)$/i;
    if (videoTypes.test(file.originalname) || imageTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('対応していないファイル形式です。動画: MP4, MOV, AVI, MKV, WebM, FLV, WMV, M4V / 静止画: JPG, PNG, GIF, BMP, WebP, TIFF のみサポートしています。'));
    }
  }
});

// プロジェクト一覧を取得
router.get('/', async (req, res) => {
  try {
    const projects = await listProjects();
    res.json({
      success: true,
      projects
    });
  } catch (error) {
    console.error('プロジェクト一覧取得エラー:', error);
    res.status(500).json({ 
      error: error.message || 'プロジェクト一覧の取得に失敗しました' 
    });
  }
});

// 新しいプロジェクトを作成
router.post('/create', async (req, res) => {
  try {
    const { url, startTime, endTime } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URLが必要です' });
    }

    console.log(`新規プロジェクト作成: ${url}`);
    
    // セッションIDを生成（進捗追跡用）
    const sessionId = `create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // オプションを準備
    const options = {};
    if (startTime || endTime) {
      options.timeRange = {
        start: startTime || '0:00',
        end: endTime
      };
    }
    
    // 進捗コールバック関数
    const progressCallback = (stage, progress, message) => {
      const progressClients = req.app.get('progressClients') || new Map();
      const client = progressClients.get(sessionId);
      if (client) {
        client.write(`data: ${JSON.stringify({
          type: 'progress',
          stage,
          progress,
          message,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };
    
    // レスポンスヘッダーを即座に送信
    res.json({
      success: true,
      sessionId,
      message: 'プロジェクト作成を開始しました'
    });
    
    // バックグラウンドでプロジェクト作成を実行
    createVideoProject(url, options, progressCallback)
      .then(result => {
        progressCallback('completed', 100, 'プロジェクト作成完了');
        console.log('✅ プロジェクト作成完了:', result.projectId);
      })
      .catch(error => {
        progressCallback('error', 0, `エラー: ${error.message}`);
        console.error('❌ プロジェクト作成エラー:', error);
      });
    
  } catch (error) {
    console.error('プロジェクト作成エラー:', error);
    res.status(500).json({ 
      error: error.message || 'プロジェクトの作成に失敗しました' 
    });
  }
});

// ローカルファイルから新しいプロジェクトを作成
router.post('/create/local', upload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: '動画ファイルが必要です' });
    }

    if (!name) {
      return res.status(400).json({ error: 'プロジェクト名が必要です' });
    }

    console.log(`ローカルファイルからプロジェクト作成: ${name} (${file.originalname})`);
    
    // セッションIDを生成（進捗追跡用）
    const sessionId = `create_local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 進捗コールバック関数
    const progressCallback = (stage, progress, message) => {
      const progressClients = req.app.get('progressClients') || new Map();
      const client = progressClients.get(sessionId);
      if (client) {
        client.write(`data: ${JSON.stringify({
          type: 'progress',
          stage,
          progress,
          message,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };
    
    // レスポンスヘッダーを即座に送信
    res.json({
      success: true,
      sessionId,
      message: 'ローカルファイルからプロジェクト作成を開始しました'
    });
    
    // バックグラウンドでプロジェクト作成を実行
    createLocalProject(file.path, file.originalname, name, progressCallback)
      .then(result => {
        progressCallback('completed', 100, 'プロジェクト作成完了');
        console.log('✅ ローカルファイルプロジェクト作成完了:', result.projectId);
        
        // アップロードファイルを削除
        fs.unlink(file.path).catch(console.error);
      })
      .catch(error => {
        progressCallback('error', 0, `エラー: ${error.message}`);
        console.error('❌ ローカルファイルプロジェクト作成エラー:', error);
        
        // エラー時もアップロードファイルを削除
        fs.unlink(file.path).catch(console.error);
      });
    
  } catch (error) {
    console.error('ローカルファイルプロジェクト作成エラー:', error);
    
    // エラー時はアップロードファイルを削除
    if (req.file) {
      fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ 
      error: error.message || 'ローカルファイルからのプロジェクト作成に失敗しました' 
    });
  }
});

// 動画・静止画結合エンドポイント
router.post('/:videoId/concat', upload.single('file'), async (req, res) => {
  try {
    const { videoId } = req.params;
    const { position, fileType, duration } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: '結合するファイルが必要です' });
    }

    if (!position || !['prepend', 'append'].includes(position)) {
      return res.status(400).json({ error: '結合位置が無効です' });
    }

    if (!fileType || !['video', 'image'].includes(fileType)) {
      return res.status(400).json({ error: 'ファイル種類が無効です' });
    }

    if (fileType === 'image' && (!duration || isNaN(parseFloat(duration)) || parseFloat(duration) <= 0)) {
      return res.status(400).json({ error: '静止画の表示時間が無効です' });
    }

    const contentType = fileType === 'image' ? '静止画' : '動画';
    console.log(`${contentType}結合: ${videoId} - ${position === 'prepend' ? '前に挿入' : '後ろに追加'} (${file.originalname}${fileType === 'image' ? `, ${duration}秒` : ''})`);
    
    // プロジェクトの存在確認
    const project = await getProject(videoId);
    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    // 高画質版動画の存在確認
    const highQualityPath = path.join(process.cwd(), 'workdir', videoId, 'video_high.mp4');
    try {
      await fs.access(highQualityPath);
    } catch {
      return res.status(400).json({ error: '高画質版動画が見つかりません' });
    }

    // ファイル結合を実行
    const { concatVideos } = await import('../services/videoConcatenator.js');
    await concatVideos(videoId, file.path, position, fileType, fileType === 'image' ? parseFloat(duration) : null);
    
    // アップロードファイルを削除
    await fs.unlink(file.path);
    
    res.json({
      success: true,
      message: `${contentType}が${position === 'prepend' ? '前に' : '後ろに'}結合されました`
    });
    
  } catch (error) {
    console.error('動画結合エラー:', error);
    
    // エラー時はアップロードファイルを削除
    if (req.file) {
      fs.unlink(req.file.path).catch(console.error);
    }
    
    res.status(500).json({ 
      error: error.message || '動画結合に失敗しました' 
    });
  }
});

// 特定のプロジェクトを取得
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const project = await getProject(videoId);
    
    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    
    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('プロジェクト取得エラー:', error);
    res.status(500).json({ 
      error: error.message || 'プロジェクトの取得に失敗しました' 
    });
  }
});

// プロジェクトを削除
router.delete('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    await deleteProject(videoId);
    
    res.json({
      success: true,
      message: 'プロジェクトが削除されました'
    });
  } catch (error) {
    console.error('プロジェクト削除エラー:', error);
    res.status(500).json({ 
      error: error.message || 'プロジェクトの削除に失敗しました' 
    });
  }
});

// 解析範囲を更新
router.put('/:videoId/analysis-range', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { analysisRange } = req.body;
    
    await updateAnalysisRange(videoId, analysisRange);
    
    res.json({
      success: true,
      message: '解析範囲が保存されました'
    });
  } catch (error) {
    console.error('解析範囲更新エラー:', error);
    res.status(500).json({ 
      error: error.message || '解析範囲の保存に失敗しました' 
    });
  }
});

// CSVを保存
router.put('/:videoId/csv', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ error: 'CSVコンテンツが必要です' });
    }
    
    await saveCSVContent(videoId, csvContent);
    
    res.json({
      success: true,
      message: 'CSVがプロジェクトに保存されました'
    });
  } catch (error) {
    console.error('CSV保存エラー:', error);
    res.status(500).json({ 
      error: error.message || 'CSVの保存に失敗しました' 
    });
  }
});

// CSVを取得
router.get('/:videoId/csv', async (req, res) => {
  try {
    const { videoId } = req.params;
    const csvContent = await getCSVContent(videoId);
    
    if (!csvContent) {
      return res.status(404).json({ error: 'CSVファイルが見つかりません' });
    }
    
    res.json({
      success: true,
      csvContent
    });
  } catch (error) {
    console.error('CSV取得エラー:', error);
    res.status(500).json({ 
      error: error.message || 'CSVの取得に失敗しました' 
    });
  }
});

// CSVをダウンロード
router.get('/:videoId/csv/download', async (req, res) => {
  try {
    const { videoId } = req.params;
    const csvContent = await getCSVContent(videoId);
    
    if (!csvContent) {
      return res.status(404).json({ error: 'CSVファイルが見つかりません' });
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}_subtitles.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('CSVダウンロードエラー:', error);
    res.status(500).json({ 
      error: error.message || 'CSVのダウンロードに失敗しました' 
    });
  }
});

// 動画を再ダウンロード
router.post('/:videoId/redownload', async (req, res) => {
  try {
    const { videoId } = req.params;
    const project = await getProject(videoId);
    
    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    
    console.log(`🔄 高画質版を再ダウンロード: ${videoId}`);
    
    // 高画質版を再ダウンロード
    const { redownloadHighQuality } = await import('../services/youtube.js');
    await redownloadHighQuality(project);
    
    res.json({
      success: true,
      message: '高画質版の再ダウンロードが完了しました'
    });
  } catch (error) {
    console.error('再ダウンロードエラー:', error);
    res.status(500).json({ 
      error: error.message || '再ダウンロードに失敗しました' 
    });
  }
});

// 解析用動画を再圧縮
router.post('/:videoId/recompress', async (req, res) => {
  try {
    const { videoId } = req.params;
    const project = await getProject(videoId);
    
    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    
    if (!project.files.highQuality) {
      return res.status(400).json({ error: '高画質版動画が見つかりません' });
    }
    
    console.log(`🔄 解析用動画を再圧縮: ${videoId}`);
    
    // 解析用動画を再圧縮
    const { recompressAnalysisVideo } = await import('../services/youtube.js');
    await recompressAnalysisVideo(project);
    
    res.json({
      success: true,
      message: '解析用動画の再圧縮が完了しました'
    });
  } catch (error) {
    console.error('再圧縮エラー:', error);
    res.status(500).json({ 
      error: error.message || '再圧縮に失敗しました' 
    });
  }
});

// プロジェクト作成進捗用のSSEエンドポイント
router.get('/create/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // SSEヘッダーを設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // progressClientsを取得または作成
  let progressClients = req.app.get('progressClients');
  if (!progressClients) {
    progressClients = new Map();
    req.app.set('progressClients', progressClients);
  }
  
  // クライアント接続を保存
  progressClients.set(sessionId, res);
  
  // 初期メッセージ
  res.write(`data: ${JSON.stringify({ 
    type: 'connected',
    message: '進捗監視を開始しました',
    timestamp: new Date().toISOString()
  })}\n\n`);
  
  // クライアントが切断された時のクリーンアップ
  req.on('close', () => {
    progressClients.delete(sessionId);
    console.log(`進捗クライアント切断: ${sessionId}`);
  });
  
  req.on('error', (err) => {
    console.error('進捗SSEエラー:', err);
    progressClients.delete(sessionId);
  });
});

// 完成動画を配信
router.get('/:videoId/video/:filename', async (req, res) => {
  try {
    const { videoId, filename } = req.params;
    
    // プロジェクト情報を取得
    const project = await getProject(videoId);
    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    
    // 完成動画ファイルのパスを構築
    const workdir = path.join(process.cwd(), 'workdir');
    const projectDir = path.join(workdir, videoId);
    const videoPath = path.join(projectDir, filename);
    
    // ファイルの存在確認
    try {
      await fs.access(videoPath);
    } catch (error) {
      return res.status(404).json({ error: '動画ファイルが見つかりません' });
    }
    
    // ファイル情報を取得
    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    
    // レンジリクエストのサポート
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      let fileStream = null;
      try {
        fileStream = await fs.open(videoPath, 'r');
        const stream = fileStream.createReadStream({ start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'video/mp4',
        });
        
        stream.pipe(res);
        
        // ストリーム終了時のクリーンアップ
        stream.on('end', () => {
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
        // エラー時のクリーンアップ
        stream.on('error', (err) => {
          console.error('ストリームエラー:', err);
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
        // クライアント切断時のクリーンアップ
        req.on('close', () => {
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
      } catch (error) {
        if (fileStream) {
          fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
        }
        throw error;
      }
    } else {
      let fileStream = null;
      try {
        fileStream = await fs.open(videoPath, 'r');
        const stream = fileStream.createReadStream();
        
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
        });
        
        stream.pipe(res);
        
        // ストリーム終了時のクリーンアップ
        stream.on('end', () => {
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
        // エラー時のクリーンアップ
        stream.on('error', (err) => {
          console.error('ストリームエラー:', err);
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
        // クライアント切断時のクリーンアップ
        req.on('close', () => {
          if (fileStream) {
            fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
          }
        });
        
      } catch (error) {
        if (fileStream) {
          fileStream.close().catch(err => console.error('ファイルクローズエラー:', err));
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('動画配信エラー:', error);
    res.status(500).json({ 
      error: error.message || '動画の配信に失敗しました' 
    });
  }
});

// 初期化（一度だけ実行）
initializeWorkdir();

export { router as projectsRouter };