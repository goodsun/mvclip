import express from 'express';
import { downloadVideo } from '../services/youtube.js';

const router = express.Router();

// YouTube動画ダウンロード
router.post('/', async (req, res) => {
  try {
    const { url, startTime, endTime, purpose } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URLが必要です' });
    }

    console.log(`ダウンロード開始: ${url}`);
    console.log(`リクエストボディ:`, req.body);
    console.log(`用途: ${purpose || 'analysis'}`);
    
    // ダウンロードオプションを準備
    const options = {
      purpose: purpose || 'analysis' // デフォルトは字幕解析用
    };
    if (startTime) {
      options.startTime = startTime;
    }
    if (endTime) {
      options.endTime = endTime;
    }
    
    const result = await downloadVideo(url, options);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    res.status(500).json({ 
      error: error.message || '動画のダウンロードに失敗しました' 
    });
  }
});

export { router as downloadRouter };