import express from 'express';
import { cropVideo } from '../services/videoCropper.js';
import { getProject } from '../services/projectManager.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// 動画クロップ + 新プロジェクト作成統合エンドポイント
router.post('/crop-project', async (req, res) => {
  try {
    const { projectId, startTime, endTime, sessionId } = req.body;
    
    if (!projectId || !startTime || !endTime) {
      return res.status(400).json({ error: '必要なパラメータが不足しています' });
    }

    console.log(`🎬 動画クロップ + 新プロジェクト作成: ${projectId} (${startTime} - ${endTime})`);
    
    // 元プロジェクトの情報を取得
    const originalProject = await getProject(projectId);
    if (!originalProject) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    // 高画質動画のパスを取得
    const videoPath = path.join(process.cwd(), 'workdir', projectId, 'video_high.mp4');
    
    // 動画ファイルの存在確認
    try {
      await fs.access(videoPath);
    } catch {
      return res.status(400).json({ error: '高画質動画ファイルが見つかりません。先にダウンロードしてください。' });
    }

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
        })}\\n\\n`);
      }
    };
    
    // 動画をクロップ
    progressCallback(10, 'クロップ処理を開始しています...');
    const outputPath = await cropVideo(videoPath, startTime, endTime, progressCallback);
    
    // 新しいプロジェクトIDを生成
    const newVideoId = `crop_${Date.now()}`;
    const newProjectDir = path.join(process.cwd(), 'workdir', newVideoId);
    await fs.mkdir(newProjectDir, { recursive: true });
    
    // クロップされた動画を新プロジェクトディレクトリに移動
    const newVideoPath = path.join(newProjectDir, 'video_high.mp4');
    await fs.rename(outputPath, newVideoPath);
    
    // 動画の長さを計算（簡易計算）
    const startSeconds = parseTimeToSeconds(startTime);
    const endSeconds = parseTimeToSeconds(endTime);
    const duration = Math.round(endSeconds - startSeconds);
    
    // 新プロジェクトのメタデータを作成
    const newProject = {
      videoId: newVideoId,
      title: `【CROP】${originalProject.title}`,
      duration: duration,
      url: originalProject.url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
      originalProject: projectId,
      cropRange: { start: startTime, end: endTime }
    };
    
    // プロジェクトファイルを作成
    const projectFilePath = path.join(newProjectDir, 'project.json');
    await fs.writeFile(projectFilePath, JSON.stringify(newProject, null, 2));
    
    progressCallback(90, '新プロジェクトを作成中...');
    
    // public/outputsにも動画をコピー（プレビュー用）
    const outputFilename = `${newVideoId}_cropped.mp4`;
    const publicOutputPath = path.join(process.cwd(), 'public', 'outputs', outputFilename);
    await fs.copyFile(newVideoPath, publicOutputPath);
    
    // 完了通知
    if (sessionId) {
      const progressClients = req.app.get('progressClients') || new Map();
      const client = progressClients.get(sessionId);
      if (client) {
        client.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          newProjectId: newVideoId,
          message: '新しいプロジェクトが作成されました'
        })}\\n\\n`);
        progressClients.delete(sessionId);
      }
    }

    res.json({
      success: true,
      newProjectId: newVideoId,
      outputPath: `/outputs/${outputFilename}`,
      message: 'クロップ動画の新プロジェクトが作成されました'
    });
  } catch (error) {
    console.error('動画クロップ + 新プロジェクト作成エラー:', error);
    res.status(500).json({ 
      error: error.message || '動画のクロップと新プロジェクト作成に失敗しました' 
    });
  }
});

// 時間文字列を秒数に変換
function parseTimeToSeconds(timeString) {
  const parts = timeString.split(':');
  let seconds = 0;
  
  if (parts.length === 3) {
    // HH:MM:SS.sss format
    const [hours, minutes, secondsWithMs] = parts;
    const [sec, ms] = secondsWithMs.split('.');
    seconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(sec);
    if (ms) {
      seconds += parseInt(ms.padEnd(3, '0')) / 1000;
    }
  } else if (parts.length === 2) {
    // MM:SS.sss format
    const [minutes, secondsWithMs] = parts;
    const [sec, ms] = secondsWithMs.split('.');
    seconds = parseInt(minutes) * 60 + parseInt(sec);
    if (ms) {
      seconds += parseInt(ms.padEnd(3, '0')) / 1000;
    }
  }
  
  return seconds;
}

export { router as videoRouter };