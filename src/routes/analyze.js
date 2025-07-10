import express from 'express';
import { transcribeVideo } from '../services/transcription.js';
import { generateCSV } from '../utils/csv.js';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// 動画を解析してCSVを生成
router.post('/', async (req, res) => {
  try {
    const { projectId, startTime, endTime } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが必要です' });
    }

    // 解析用動画のパスを取得
    const videoPath = path.join(process.cwd(), 'workdir', projectId, 'video_analysis.mp4');
    
    // 動画ファイルの存在確認
    try {
      await fs.access(videoPath);
    } catch {
      return res.status(400).json({ error: '解析用動画ファイルが見つかりません。先にダウンロードしてください。' });
    }

    // 時間範囲の設定
    const timeRange = (startTime || endTime) ? { start: startTime, end: endTime } : null;

    console.log(`音声認識開始: ${videoPath}`);
    
    // 時間範囲が指定されている場合のログ
    if (timeRange) {
      console.log(`📍 時間範囲指定あり: ${timeRange.start} 〜 ${timeRange.end}`);
    }
    
    // 音声認識を実行（時間範囲を渡す）
    const transcription = await transcribeVideo(videoPath, timeRange);
    
    // 時間オフセットを計算（開始時刻が指定されている場合）
    let timeOffset = 0;
    if (timeRange && timeRange.start) {
      // 時間文字列を秒数に変換（ミリ秒対応）
      const parseTimeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        if (typeof timeStr === 'number') return timeStr;
        const timeParts = timeStr.split(':');
        if (timeParts.length === 2) {
          const mins = parseInt(timeParts[0]);
          const secParts = timeParts[1].split('.');
          const secs = parseInt(secParts[0]);
          const ms = secParts[1] ? parseInt(secParts[1]) : 0;
          return mins * 60 + secs + ms / 1000;
        }
        return parseFloat(timeStr);
      };
      timeOffset = parseTimeToSeconds(timeRange.start);
      console.log(`⏱️ CSVに時間オフセット適用: +${timeOffset}秒`);
    }
    
    // CSVを生成（時間オフセットを適用）
    const csvContent = generateCSV(transcription, timeOffset);
    
    // CSVファイルを保存
    const csvFilename = `${projectId}_${Date.now()}.csv`;
    const csvPath = path.join(process.cwd(), 'public', 'outputs', csvFilename);
    
    // outputsディレクトリを作成
    await fs.mkdir(path.dirname(csvPath), { recursive: true });
    await fs.writeFile(csvPath, csvContent, 'utf8');
    
    // プロジェクトのsubtitles.csvも更新
    const projectCsvPath = path.join(process.cwd(), 'workdir', projectId, 'subtitles.csv');
    await fs.writeFile(projectCsvPath, csvContent, 'utf8');
    
    res.json({
      success: true,
      csvContent: csvContent,
      csvPath: `/outputs/${csvFilename}`,
      message: '解析が完了しました'
    });
    
  } catch (error) {
    console.error('解析エラー:', error);
    res.status(500).json({ 
      error: error.message || '動画の解析に失敗しました' 
    });
  }
});

export { router as analyzeRouter };