import express from 'express';
import { downloadVideo } from '../services/youtube.js';

const router = express.Router();

// 利用可能なフォーマット一覧を取得
router.post('/', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URLが必要です' });
    }

    console.log(`フォーマット一覧取得: ${url}`);
    
    const result = await downloadVideo(url, { listOnly: true });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('フォーマット取得エラー:', error);
    res.status(500).json({ 
      error: error.message || 'フォーマット情報の取得に失敗しました' 
    });
  }
});

export { router as formatsRouter };