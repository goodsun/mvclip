import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { parseTime } from '../utils/csv.js';
import { generateVideoCommand, getCompressionSettings } from '../config/compression.js';

const execAsync = promisify(exec);

// リトライ機能
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`リトライ ${i + 1}/${maxRetries}: ${error.message}`);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 指数バックオフ
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

export async function processVideoWithSubtitles(videoPath, segments, progressCallback = null, compressionLevel = 'medium') {
  let tempDir = null;
  const createdFiles = [];
  
  try {
    tempDir = path.join(process.cwd(), 'temp', `process_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    console.log(`🔧 使用中の圧縮設定: ${getCompressionSettings(compressionLevel).name}`);
    
    // 各セグメントを切り抜き
    const clipPaths = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const clipPath = path.join(tempDir, `clip_${i.toString().padStart(3, '0')}.mp4`);
      
      const startTime = parseTime(segment.start);
      const endTime = parseTime(segment.end);
      const duration = endTime - startTime;
      
      // セグメントごとに個別のSRTファイルを生成
      // 字幕のタイミングは0ベースで正確に
      const segmentSrtPath = path.join(tempDir, `segment_${i}.srt`);
      const adjustedSegment = {
        start: 0,
        end: duration,
        text: segment.text
      };
      await generateSRT([adjustedSegment], segmentSrtPath);
      createdFiles.push(segmentSrtPath);
      
      // 時間範囲付きの動画処理用一時ファイルを作成
      const tempClipPath = path.join(tempDir, `temp_clip_${i.toString().padStart(3, '0')}.mp4`);
      
      // まず、時間範囲を指定して動画を切り抜き
      const extractCmd = `ffmpeg -ss ${startTime} -i "${videoPath}" -t ${duration} -c copy -y "${tempClipPath}"`;
      
      // 圧縮設定を使用してFFmpegコマンドを生成（字幕付き）
      const ffmpegCmd = generateVideoCommand(tempClipPath, clipPath, compressionLevel, segmentSrtPath);
      
      console.log(`セグメント ${i + 1}/${segments.length} を処理中... (開始: ${segment.start}, 終了: ${segment.end})`);
      
      // プログレス情報を送信
      if (progressCallback) {
        progressCallback(i + 1, segments.length, segment);
      }
      
      // 動画処理の再試行機能を追加
      await retryWithBackoff(async () => {
        try {
          // 1. 時間範囲を抽出（高速、コピーのみ）
          await execAsync(extractCmd);
          
          // 2. 字幕を追加して圧縮
          await execAsync(ffmpegCmd);
          
          // 動画ファイルが正常に作成されたかを確認
          if (!fs.existsSync(clipPath)) {
            throw new Error(`セグメント ${i + 1} の動画ファイルの作成に失敗しました`);
          }
          
          // ファイルサイズが0でないことを確認
          const clipStats = fs.statSync(clipPath);
          if (clipStats.size === 0) {
            throw new Error(`セグメント ${i + 1} の動画ファイルが空です`);
          }
          
          console.log(`✅ セグメント ${i + 1} 処理完了: ${(clipStats.size / (1024 * 1024)).toFixed(2)} MB`);
          
        } catch (error) {
          console.error(`セグメント ${i + 1} 処理エラー:`, error);
          
          // 失敗した動画ファイルを削除
          if (fs.existsSync(clipPath)) {
            fs.unlinkSync(clipPath);
          }
          if (fs.existsSync(tempClipPath)) {
            fs.unlinkSync(tempClipPath);
          }
          
          throw error;
        }
      }, 3, 2000);
      
      // 一時ファイルを削除
      if (fs.existsSync(segmentSrtPath)) {
        fs.unlinkSync(segmentSrtPath);
      }
      if (fs.existsSync(tempClipPath)) {
        fs.unlinkSync(tempClipPath);
      }
      
      clipPaths.push(clipPath);
      createdFiles.push(clipPath);
    }
    
    console.log('\n📹 セグメント処理完了！クリップを結合中...');
    
    // クリップを結合
    const outputPath = path.join(tempDir, `output_${Date.now()}.mp4`);
    await concatenateClips(clipPaths, outputPath);
    
    console.log('🧹 一時ファイルを削除中...');
    
    // 一時ファイルを削除
    for (const clipPath of clipPaths) {
      if (fs.existsSync(clipPath)) {
        fs.unlinkSync(clipPath);
      }
    }
    
    console.log('🎉 動画処理完了！');
    console.log(`📁 出力ファイル: ${path.basename(outputPath)}`);
    
    return outputPath;
  } catch (error) {
    console.error('動画処理エラー:', error);
    
    // エラー時に一時ファイルをクリーンアップ
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        // 作成されたファイルを削除
        for (const file of createdFiles) {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
        
        // 一時ディレクトリを削除（空の場合）
        try {
          fs.rmdirSync(tempDir);
          console.log('🧹 エラー時の一時ディレクトリをクリーンアップしました');
        } catch (rmError) {
          console.log('一時ディレクトリにファイルが残っているため、削除をスキップしました');
        }
      } catch (cleanupError) {
        console.error('一時ファイルクリーンアップエラー:', cleanupError);
      }
    }
    
    throw new Error(`動画の処理に失敗しました: ${error.message}`);
  }
}

async function generateSRT(segments, outputPath) {
  let srtContent = '';
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // segmentが数値型の場合はそのまま使用、文字列の場合はparseTime
    const startSeconds = typeof segment.start === 'number' ? segment.start : parseTime(segment.start);
    const endSeconds = typeof segment.end === 'number' ? segment.end : parseTime(segment.end);
    
    const startTime = formatSRTTime(startSeconds);
    const endTime = formatSRTTime(endSeconds);
    
    srtContent += `${i + 1}\n`;
    srtContent += `${startTime} --> ${endTime}\n`;
    srtContent += `${segment.text}\n\n`;
  }
  
  fs.writeFileSync(outputPath, srtContent, 'utf8');
}

function formatSRTTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

async function concatenateClips(clipPaths, outputPath) {
  console.log(`🔗 ${clipPaths.length}個のクリップを結合中...`);
  
  // concatファイルを作成
  const listPath = outputPath.replace('.mp4', '_list.txt');
  const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  
  // ffmpegで結合
  const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -y "${outputPath}"`;
  await execAsync(ffmpegCmd);
  
  console.log('✅ クリップ結合完了');
  
  // listファイルを削除
  fs.unlinkSync(listPath);
}