import OpenAI from 'openai';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import { generateAudioCommand, getCompressionSettings } from '../config/compression.js';

dotenv.config();

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30秒タイムアウト（短縮してまず接続確認）
  maxRetries: 2,  // 最大2回リトライ
});

// 時間をパースして秒数に変換（ミリ秒対応）
const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  
  // すでに数値の場合はそのまま返す
  if (typeof timeStr === 'number') return timeStr;
  
  // hh:mm:ss.sss, mm:ss.sss または mm:ss 形式
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    
    if (parts.length === 3) {
      // hh:mm:ss.sss 形式
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      // mm:ss.sss 形式
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseFloat(parts[1]) || 0;
      return minutes * 60 + seconds;
    }
  }
  
  // 秒数のみ（小数点対応）
  return parseFloat(timeStr) || 0;
};

export async function transcribeVideo(videoPath, timeRange = null, compressionLevel = 'medium') {
  let audioPath = null;
  
  try {
    // 動画から音声を抽出（字幕解析用に最適化）
    audioPath = videoPath.replace('.mp4', '_audio_optimized.mp3');
    
    // 時間範囲の解析
    let startSeconds = 0;
    let duration = null;
    
    if (timeRange) {
      console.log(`🎯 時間範囲指定: ${timeRange.start} - ${timeRange.end}`);
      
      startSeconds = parseTime(timeRange.start);
      const endSeconds = parseTime(timeRange.end);
      duration = endSeconds - startSeconds;
      
      console.log(`⏱️ 解析範囲: ${startSeconds}秒 〜 ${endSeconds}秒 (${duration}秒間)`);
    }
    
    console.log(`音声抽出中（字幕解析用最適化）: ${audioPath}`);
    
    // 圧縮設定を使用してFFmpegコマンドを生成
    const ffmpegCmd = generateAudioCommand(
      videoPath, 
      audioPath, 
      compressionLevel,
      startSeconds > 0 ? startSeconds : null,
      duration > 0 ? duration : null
    );
    
    console.log(`🔧 使用中の圧縮設定: ${getCompressionSettings(compressionLevel).name}`);
    
    // 音声抽出の再試行機能を追加
    await retryWithBackoff(async () => {
      try {
        await execAsync(ffmpegCmd);
        
        // 音声ファイルが正常に作成されたかを確認
        if (!fs.existsSync(audioPath)) {
          throw new Error('音声ファイルの作成に失敗しました');
        }
        
        // ファイルサイズが0でないことを確認
        const audioStats = fs.statSync(audioPath);
        if (audioStats.size === 0) {
          throw new Error('音声ファイルが空です');
        }
        
        console.log(`✅ 音声抽出完了: ${(audioStats.size / (1024 * 1024)).toFixed(2)} MB`);
        
      } catch (error) {
        console.error('音声抽出エラー:', error);
        // 失敗した音声ファイルを削除
        if (fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
        throw error;
      }
    }, 3, 2000);
    
    // 最適化効果の確認
    const originalStats = fs.statSync(videoPath);
    const audioStats = fs.statSync(audioPath);
    const originalSizeMB = originalStats.size / (1024 * 1024);
    const audioSizeMB = audioStats.size / (1024 * 1024);
    const compressionRatio = ((originalSizeMB - audioSizeMB) / originalSizeMB * 100).toFixed(1);
    
    console.log(`📊 ファイルサイズ最適化結果:`);
    console.log(`   元動画: ${originalSizeMB.toFixed(2)} MB`);
    console.log(`   最適化音声: ${audioSizeMB.toFixed(2)} MB`);
    console.log(`   圧縮率: ${compressionRatio}% 削減`);
    
    // 音声ファイルを分割（10MB以上は分割処理）
    const fileSizeInMB = audioSizeMB;
    
    if (fileSizeInMB > 10) {
      // 10MB以上のファイルは分割処理（接続エラー対策）
      console.log('🔄 大きなファイルのため分割処理を実行します...');
      return await transcribeLargeAudio(audioPath);
    }
    
    // Whisper APIで音声認識（リトライ機能付き）
    console.log('Whisper APIで音声認識中...');
    const transcription = await retryWithBackoff(async () => {
      // ファイルサイズを確認してログ出力
      const stats = fs.statSync(audioPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      console.log(`音声ファイルサイズ: ${fileSizeInMB.toFixed(2)} MB`);
      
      return await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });
    }, 3);
    
    // WhisperAPIの生の結果をログ出力（ミリ秒精度確認）
    console.log('🔍 WhisperAPI生結果の詳細:');
    console.log(`  総セグメント数: ${transcription.segments ? transcription.segments.length : 0}`);
    console.log(`  総時間: ${transcription.duration ? transcription.duration.toFixed(3) : 'N/A'}秒`);
    
    if (transcription.segments && transcription.segments.length > 0) {
      console.log('  最初の3セグメント:');
      transcription.segments.slice(0, 3).forEach((seg, i) => {
        console.log(`    [${i + 1}] 生の値: start=${seg.start}, end=${seg.end}`);
        console.log(`        フォーマット: ${seg.start.toFixed(3)}s - ${seg.end.toFixed(3)}s: "${seg.text}"`);
      });
      
      console.log('  最後の3セグメント:');
      transcription.segments.slice(-3).forEach((seg, i) => {
        const index = transcription.segments.length - 3 + i + 1;
        console.log(`    [${index}] 生の値: start=${seg.start}, end=${seg.end}`);
        console.log(`        フォーマット: ${seg.start.toFixed(3)}s - ${seg.end.toFixed(3)}s: "${seg.text}"`);
      });
    }
    
    // word レベルのタイムスタンプも確認
    if (transcription.words && transcription.words.length > 0) {
      console.log('  最初の3ワード:');
      transcription.words.slice(0, 3).forEach((word, i) => {
        console.log(`    [${i + 1}] ${word.start.toFixed(3)}s - ${word.end.toFixed(3)}s: "${word.word}"`);
      });
    }
    
    // 一時ファイルを削除
    if (fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
      console.log('🧹 一時音声ファイルを削除しました');
    }
    
    // 動画の実際の長さを取得して無音部分を補完
    let videoDuration;
    if (timeRange && timeRange.end) {
      // 時間範囲が指定されている場合は、終了時間を使用
      const endSeconds = parseTime(timeRange.end);
      const startSeconds = parseTime(timeRange.start || '0');
      videoDuration = endSeconds - startSeconds;
      console.log(`🎯 時間範囲の長さ: ${videoDuration.toFixed(3)}秒`);
    } else {
      videoDuration = await getVideoDuration(videoPath);
    }
    const completedTranscription = fillSilentGaps(transcription, videoDuration);
    
    return completedTranscription;
  } catch (error) {
    console.error('音声認識エラー:', error);
    
    // エラー時に一時ファイルをクリーンアップ
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
        console.log('🧹 エラー時の一時ファイルをクリーンアップしました');
      } catch (cleanupError) {
        console.error('一時ファイルクリーンアップエラー:', cleanupError);
      }
    }
    
    throw new Error(`音声認識に失敗しました: ${error.message}`);
  }
}

async function transcribeLargeAudio(audioPath) {
  try {
    // 音声ファイルを分割
    const segmentDir = path.dirname(audioPath) + '/segments';
    fs.mkdirSync(segmentDir, { recursive: true });
    
    // 5分ごとに分割
    await execAsync(`ffmpeg -i "${audioPath}" -f segment -segment_time 300 -c copy "${segmentDir}/segment_%03d.mp3"`);
    
    const segments = fs.readdirSync(segmentDir).filter(f => f.endsWith('.mp3')).sort();
    const allSegments = [];
    let currentTime = 0;
    
    for (const segment of segments) {
      const segmentPath = path.join(segmentDir, segment);
      console.log(`セグメント処理中: ${segment}`);
      
      const transcription = await retryWithBackoff(async () => {
        return await openai.audio.transcriptions.create({
          file: fs.createReadStream(segmentPath),
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment']
        });
      }, 3);
      
      // タイムスタンプを調整
      if (transcription.segments) {
        transcription.segments.forEach(seg => {
          seg.start += currentTime;
          seg.end += currentTime;
          allSegments.push(seg);
        });
        currentTime = allSegments[allSegments.length - 1].end;
      }
      
      fs.unlinkSync(segmentPath);
    }
    
    // セグメントディレクトリを削除
    fs.rmdirSync(segmentDir);
    fs.unlinkSync(audioPath);
    
    return {
      text: allSegments.map(s => s.text).join(' '),
      segments: allSegments
    };
  } catch (error) {
    console.error('大容量音声処理エラー:', error);
    throw error;
  }
}

// 動画の長さを取得する関数
async function getVideoDuration(videoPath) {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`);
    return parseFloat(stdout.trim());
  } catch (error) {
    console.error('動画の長さ取得エラー:', error);
    return 0;
  }
}

// 無音部分を空白字幕で補完する関数
function fillSilentGaps(transcription, videoDuration) {
  if (!transcription.segments || transcription.segments.length === 0) {
    // 音声認識結果がない場合、全体を無音として扱う
    return {
      text: "",
      segments: [{
        start: 0,
        end: videoDuration,
        text: ""
      }]
    };
  }

  const segments = [...transcription.segments];
  const filledSegments = [];
  
  // 最初のセグメントより前に無音がある場合
  if (segments[0].start > 0.01) { // より精密な閾値
    filledSegments.push({
      start: 0,
      end: segments[0].start, // ミリ秒精度を保持
      text: ""
    });
  }
  
  // セグメント間の空白を埋める
  for (let i = 0; i < segments.length; i++) {
    filledSegments.push(segments[i]);
    
    // 次のセグメントとの間に空白がある場合
    if (i < segments.length - 1) {
      const gap = segments[i + 1].start - segments[i].end;
      if (gap > 0.01) { // 0.01秒以上の空白（ミリ秒精度）
        filledSegments.push({
          start: segments[i].end, // ミリ秒精度を保持
          end: segments[i + 1].start, // ミリ秒精度を保持
          text: ""
        });
      }
    }
  }
  
  // 最後のセグメント後に無音がある場合
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.end < videoDuration - 0.01) { // より精密な閾値
    filledSegments.push({
      start: lastSegment.end, // ミリ秒精度を保持
      end: videoDuration, // 動画の正確な長さ
      text: ""
    });
  }
  
  console.log(`📝 無音部分補完: ${segments.length}個 → ${filledSegments.length}個のセグメント`);
  console.log(`📹 動画長: ${videoDuration.toFixed(3)}秒, 最後のセグメント: ${filledSegments[filledSegments.length - 1].end.toFixed(3)}秒`);
  
  // 補完後の最初の数セグメントをミリ秒精度でログ出力
  console.log('🔍 補完後の最初の3セグメント:');
  filledSegments.slice(0, 3).forEach((seg, i) => {
    const text = seg.text ? `"${seg.text}"` : '""';
    console.log(`  セグメント${i + 1}: ${seg.start.toFixed(3)}s - ${seg.end.toFixed(3)}s: ${text}`);
  });
  
  return {
    text: transcription.text,
    segments: filledSegments
  };
}