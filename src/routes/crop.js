import express from 'express';
import { cropVideo } from '../services/videoCropper.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// 動画クロップ処理
router.post('/', async (req, res) => {
  try {
    const { projectId, videoPath, startTime, endTime, sessionId } = req.body;
    
    if (!projectId || !videoPath || !startTime || !endTime) {
      return res.status(400).json({ error: '必要なパラメータが不足しています' });
    }

    console.log(`🎬 動画クロップ開始: ${projectId} (${startTime} - ${endTime})`);
    
    // 進捗コールバック関数
    const progressCallback = (progress, message) => {
      const progressClients = req.app.get('progressClients') || new Map();
      const client = progressClients.get(sessionId);
      if (client) {
        client.write(`data: ${JSON.stringify({
          type: 'progress',
          stage: 'cropping',
          progress,
          message,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    };
    
    // 動画をクロップ
    const outputPath = await cropVideo(videoPath, startTime, endTime, progressCallback);
    
    // 出力ファイル名を取得
    const outputFilename = path.basename(outputPath);
    const publicOutputPath = path.join(process.cwd(), 'public', 'outputs', outputFilename);
    
    // public/outputsに移動
    await fs.rename(outputPath, publicOutputPath);
    
    // ファイル情報を取得
    const stats = await fs.stat(publicOutputPath);
    const fileSize = stats.size;
    
    // 完了通知
    if (sessionId) {
      const progressClients = req.app.get('progressClients') || new Map();
      const client = progressClients.get(sessionId);
      if (client) {
        client.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          outputPath: `/outputs/${outputFilename}`
        })}\n\n`);
        progressClients.delete(sessionId);
      }
    }

    res.json({
      success: true,
      outputPath: `/outputs/${outputFilename}`,
      fileSize: fileSize,
      duration: null, // 動画の継続時間は後で計算可能
      message: 'クロップ動画が生成されました'
    });
  } catch (error) {
    console.error('動画クロップエラー:', error);
    res.status(500).json({ 
      error: error.message || '動画のクロップに失敗しました' 
    });
  }
});

export { router as cropRouter };