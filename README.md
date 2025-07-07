# YouTube Clip Subtitles

YouTube動画を切り抜いて字幕を付けるサービス  
音声認識技術を使用してCSVから動画編集まで一括処理を行う。

## 主な機能

### 🎬 プロジェクト管理
- YouTube動画のダウンロード（高画質版・解析用の2つ）
- プロジェクト単位での動画・字幕・範囲設定の管理
- workdirディレクトリでのファイル整理

### 🔍 音声認識・字幕解析
- OpenAI Whisper APIを使用した高精度音声認識
- 解析範囲の指定（開始時間～終了時間）
- CSV形式での字幕データ出力・編集

### ✂️ 動画編集・切り抜き
- CSVに基づく自動動画切り抜き
- 字幕埋め込み（日本語対応）
- 字幕確認用・正式版の2段階生成

### 🎮 プレビュー・範囲設定
- 2つの動画品質でのプレビュー再生
- 5秒・10秒スキップ機能
- 範囲再生・全体再生の切り替え
- 現在位置からの範囲設定
- キーボードショートカット対応

## CSVフォーマット

```csv
start,end,text
0:00.000,0:05.500,こんにちは、今日はいい天気ですね
0:06.000,0:12.300,このプロジェクトについて説明します
```

## Quick Start

```bash
# 1. 依存関係をインストール
npm install

# 2. FFmpegをインストール (Mac) - 字幕対応版
# 古いバージョンがある場合は削除
brew uninstall --force --ignore-dependencies ffmpeg 2>/dev/null || true

# pkg-configをインストール（libass検出用）
brew install pkg-config

# 最新FFmpeg（字幕ライブラリlibass搭載）をインストール
brew install ffmpeg

# 3. OpenAI API Keyを取得・設定
# https://platform.openai.com/api-keys でAPI keyを作成
# 2024年よりプロジェクトAPIキー（sk-proj-）のみ利用可能
echo "OPENAI_API_KEY=sk-proj-your_project_api_key_here" > .env

# 4. サーバーを起動
npm run dev

# 5. ブラウザでアクセス
open http://localhost:3000
```

## 技術スタック

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **動画処理**: FFmpeg
- **音声認識**: OpenAI Whisper API
- **動画ダウンロード**: ytdl-core

## ファイル構成

```
├── src/
│   ├── index.js              # メインサーバー
│   ├── routes/
│   │   ├── projects.js       # プロジェクト管理API
│   │   ├── download.js       # YouTube動画ダウンロード
│   │   ├── analyze.js        # 音声認識・CSV生成
│   │   └── process.js        # 動画処理（SSE対応）
│   ├── services/
│   │   ├── youtube.js        # YouTube API
│   │   ├── transcription.js  # 音声認識
│   │   ├── videoProcessor.js # 動画処理
│   │   └── projectManager.js # プロジェクト管理
│   └── utils/
│       └── csv.js            # CSV操作
├── public/
│   ├── index.html            # SPA メインページ
│   ├── style.css             # スタイル（範囲制御含む）
│   └── script.js             # フロントエンド機能
├── workdir/                  # プロジェクトファイル
│   └── {videoId}/
│       ├── project.json      # プロジェクトメタデータ
│       ├── video_high.mp4    # 高画質版（編集用）
│       ├── video_analysis.mp4 # 解析用（プレビュー用）
│       └── subtitles.csv     # 字幕データ
├── temp/                     # 一時ファイル
└── nodemon.json              # 開発用設定
```

## ⚠️ 重要な要件

### OpenAI APIキー
- **現在**: プロジェクトAPIキー（`sk-proj-` プレフィックス）のみ利用可能
- **作成**: OpenAI Platform > Projects > API Keys
- **権限**: Audio API（Whisper）アクセス権限
- **注意**: 一部環境でファイルアップロード時にネットワークエラーが発生する場合があります
- **詳細**: `docs/openai-api-requirements.md` を参照

### その他の要件
- **FFmpeg**: 字幕フィルター対応版（7.x以降推奨）
- **libass**: 字幕レンダリングライブラリ（最新FFmpegに含まれる）
- 大きな動画ファイル（>25MB）は処理に時間がかかります
- 生成されたファイルは定期的に削除してください

## 🔧 トラブルシューティング

### 字幕フィルターエラー（"No such filter: 'subtitles'"）
1. FFmpegバージョンを確認: `ffmpeg -version`
2. libass対応確認: `ffmpeg -filters | grep subtitles`
3. 最新FFmpegに更新: `docs/ffmpeg-setup.md` を参照

### ECONNRESETエラーが発生する場合
1. ネットワーク設定を確認（プロキシ・ファイアウォール）
2. 別のネットワーク環境で試す
3. `docs/openai-api-requirements.md` で代替アプローチを確認

### APIキーの確認方法
```bash
# APIキーの形式を確認
echo $OPENAI_API_KEY | head -c 8
# 期待値：sk-proj- （2024年以降の標準形式）
```

### アカウント状況の確認
```bash
# OpenAI APIアカウントの状況確認
node check_account_status.js
```

### プロジェクト作成時のループエラー
- `nodemon.json`でworkdirを監視対象外に設定済み
- 開発サーバーの再起動を防ぐため、watchファイルを調整

### 動画プレビューが表示されない場合
- プロジェクトファイルが正しく保存されているか確認
- ブラウザの開発者ツールでネットワークエラーを確認
- workdirディレクトリのアクセス権限を確認

## 📚 ドキュメント

- **🔰 初心者ガイド**: `docs/beginner-setup-guide.md` 
- **🎬 FFmpegセットアップ**: `docs/ffmpeg-setup.md`
- **API要件**: `docs/openai-api-requirements.md`
- **課金設定**: `docs/openai-billing-setup.md`
- **音声最適化**: `docs/audio-optimization.md`
- **API料金**: `docs/whisper-api-costs.md`

## 📋 APIエンドポイント

### プロジェクト管理
- `GET /api/projects` - プロジェクト一覧取得
- `POST /api/projects/create` - 新規プロジェクト作成
- `GET /api/projects/:videoId` - プロジェクト詳細取得
- `DELETE /api/projects/:videoId` - プロジェクト削除
- `PUT /api/projects/:videoId/analysis-range` - 解析範囲保存
- `GET /api/projects/:videoId/csv` - CSV取得
- `PUT /api/projects/:videoId/csv` - CSV保存
- `GET /api/projects/:videoId/csv/download` - CSVダウンロード
- `GET /projects/:videoId/:fileName` - プロジェクトファイル配信

### 音声認識・動画処理
- `POST /api/analyze` - 音声認識実行
- `POST /api/process` - 動画処理実行
- `GET /api/process/progress/:sessionId` - リアルタイム進捗（SSE）

## 🎮 キーボードショートカット

- `Space` - 再生/一時停止
- `←` / `→` - 5秒戻る/進む
- `Shift + ←` / `Shift + →` - 10秒戻る/進む
- `R` - 範囲再生切り替え
- `F` - 全体再生切り替え