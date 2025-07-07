import express from 'express';
import { processVideoWithSubtitles } from '../services/videoProcessor.js';
import { parseCSV } from '../utils/csv.js';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// 処理中のリクエストを追跡
const processingRequests = new Set();

// プログレス更新のためのクライアント接続を保存
const progressClients = new Map();

// プログレス更新用のSSEエンドポイント
router.get('/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  // SSEヘッダーを設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // クライアント接続を保存
  progressClients.set(sessionId, res);
  
  // 初期メッセージ
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // クライアントが切断された時のクリーンアップ
  req.on('close', () => {
    progressClients.delete(sessionId);
  });
});

// CSVに基づいて動画を処理
router.post('/', async (req, res) => {
  try {
    const { videoPath, csvPath, sessionId } = req.body;
    
    if (!videoPath || !csvPath) {
      return res.status(400).json({ error: '動画パスとCSVパスが必要です' });
    }

    // 重複処理チェック
    const requestKey = `${videoPath}_${csvPath}`;
    if (processingRequests.has(requestKey)) {
      return res.status(409).json({ error: '同じ動画が既に処理中です。しばらくお待ちください。' });
    }

    // 処理開始をマーク
    processingRequests.add(requestKey);

    // CSVファイルを読み込む
    const fullCsvPath = path.join(process.cwd(), 'public', csvPath);
    const csvContent = await fs.readFile(fullCsvPath, 'utf8');
    const segments = parseCSV(csvContent);
    
    console.log(`動画処理開始: ${segments.length}個のセグメント`);
    console.log(`使用する動画パス: ${videoPath}`);
    
    // videoPathがURLの場合はエラー
    if (videoPath.startsWith('http')) {
      throw new Error('動画編集には事前にダウンロードされたローカルファイルが必要です。「YouTubeからダウンロード」ボタンでダウンロードしてください。');
    }
    
    // ローカルファイルの存在確認
    try {
      await fs.access(videoPath);
    } catch (error) {
      throw new Error(`指定された動画ファイルが見つかりません: ${videoPath}`);
    }
    
    // プログレス更新関数
    const sendProgress = (current, total, segment) => {
      if (sessionId && progressClients.has(sessionId)) {
        const client = progressClients.get(sessionId);
        const progressData = {
          type: 'progress',
          current,
          total,
          segment: {
            start: segment.start,
            end: segment.end,
            text: segment.text
          }
        };
        client.write(`data: ${JSON.stringify(progressData)}\n\n`);
      }
    };

    // 動画を処理
    const outputPath = await processVideoWithSubtitles(videoPath, segments, sendProgress);
    
    // 出力ファイル名を取得
    const outputFilename = path.basename(outputPath);
    const publicOutputPath = path.join(process.cwd(), 'public', 'outputs', outputFilename);
    
    // public/outputsに移動
    await fs.rename(outputPath, publicOutputPath);
    
    // 完了通知
    if (sessionId && progressClients.has(sessionId)) {
      const client = progressClients.get(sessionId);
      client.write(`data: ${JSON.stringify({ type: 'complete', outputPath: `/outputs/${outputFilename}` })}\n\n`);
      progressClients.delete(sessionId);
    }

    res.json({
      success: true,
      outputPath: `/outputs/${outputFilename}`,
      segments: segments.length
    });
  } catch (error) {
    console.error('動画処理エラー:', error);
    res.status(500).json({ 
      error: error.message || '動画の処理に失敗しました' 
    });
  } finally {
    // 処理完了時にリクエストキーを削除
    const requestKey = `${req.body.videoPath}_${req.body.csvPath}`;
    processingRequests.delete(requestKey);
  }
});

export { router as processRouter };