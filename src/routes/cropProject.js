import express from 'express';
import { createCropProject } from '../services/cropProjectManager.js';

const router = express.Router();

// クロップ動画から新プロジェクトを作成
router.post('/', async (req, res) => {
  try {
    const { 
      originalProjectId, 
      croppedVideoPath, 
      title, 
      cropRange, 
      originalUrl 
    } = req.body;
    
    if (!originalProjectId || !croppedVideoPath || !title) {
      return res.status(400).json({ error: '必要なパラメータが不足しています' });
    }

    console.log(`🆕 クロップ動画から新プロジェクト作成: ${title}`);
    
    // 新プロジェクトを作成
    const result = await createCropProject({
      originalProjectId,
      croppedVideoPath,
      title,
      cropRange,
      originalUrl
    });

    res.json({
      success: true,
      projectId: result.projectId,
      title: result.title,
      message: '新プロジェクトが作成されました'
    });
  } catch (error) {
    console.error('クロップ動画からの新プロジェクト作成エラー:', error);
    res.status(500).json({ 
      error: error.message || '新プロジェクトの作成に失敗しました' 
    });
  }
});

export { router as cropProjectRouter };