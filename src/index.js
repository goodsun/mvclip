import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs/promises';
import fsSync from 'fs';

import { downloadRouter } from './routes/download.js';
import { analyzeRouter } from './routes/analyze.js';
import { processRouter } from './routes/process.js';
import { formatsRouter } from './routes/formats.js';
import { projectsRouter } from './routes/projects.js';
import { fontsRouter } from './routes/fonts.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Upload configuration
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Routes
app.use('/api/download', downloadRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/process', processRouter);
app.use('/api/formats', formatsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/fonts', fontsRouter);

// プロジェクトファイル配信
app.get('/projects/:videoId/:fileName', (req, res) => {
  const { videoId, fileName } = req.params;
  const filePath = path.join(__dirname, '../workdir', videoId, fileName);
  
  // セキュリティチェック: パストラバーサル攻撃を防ぐ
  const normalizedPath = path.normalize(filePath);
  const workdirPath = path.join(__dirname, '../workdir');
  
  if (!normalizedPath.startsWith(workdirPath)) {
    return res.status(403).json({ error: 'アクセスが拒否されました' });
  }
  
  // ファイルの存在確認
  if (!fsSync.existsSync(normalizedPath)) {
    return res.status(404).json({ error: 'ファイルが見つかりません' });
  }
  
  // Content-Typeを設定
  if (fileName.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
  } else if (fileName.endsWith('.csv')) {
    res.setHeader('Content-Type', 'text/csv');
  }
  
  res.sendFile(normalizedPath);
});

// CSV upload endpoint
app.post('/api/upload-csv', upload.single('csv'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSVファイルがアップロードされていません' });
  }
  res.json({ 
    success: true, 
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
  console.log(`http://localhost:${PORT}`);
});