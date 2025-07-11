# OpenAI API 要件と権限設定

## 📋 現在のAPIキーシステム（2024年更新）

### 🔄 重要：OpenAIの仕様変更
**2024年にOpenAIはプロジェクトベースAPIキーに完全移行しました**

### ✅ 現在利用可能：プロジェクトAPIキー
- **プレフィックス**: `sk-proj-xxxxxxxxxxxxxxxxxxxxxxx`
- **作成方法**: OpenAI Platform > Projects > API Keys
- **ステータス**: 2024年より唯一作成可能なAPIキー
- **特徴**: プロジェクト単位でのアクセス制御

### ❌ 廃止済み：クラシックAPIキー
- **プレフィックス**: `sk-xxxxxxxxxxxxxxxxxxxxxxx`
- **ステータス**: 2024年に新規作成廃止
- **既存キー**: まだ利用可能（段階的廃止予定）

## 🔑 APIキーの作成方法

### 1. OpenAI Platform にアクセス
https://platform.openai.com/api-keys

### 2. プロジェクト作成
1. 「Create new project」をクリック
2. プロジェクト名を入力（例：mvclip-project）
3. 用途を選択（Personal use など）

### 3. APIキー作成
1. プロジェクト内で「API Keys」タブを選択
2. 「Create new secret key」をクリック
3. 名前を入力（例：mvclip-api-key）
4. 権限を設定：
   - ✅ **All**: 全ての権限（推奨）
   - または個別に **Audio** 権限を選択

## 💰 使用量と制限

### Whisper API制限
- **ファイルサイズ**: 最大25MB
- **対応形式**: mp3, mp4, mpeg, mpga, m4a, wav, webm
- **レート制限**: APIキータイプにより異なる

### 料金目安
- **Whisper-1**: $0.006 / 分
- **例**: 10分動画 = 約$0.06（約9円）

## 🔧 設定手順

### 1. 環境変数設定
```bash
# .env ファイルに追加（プロジェクトAPIキーの場合）
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxx
```

### 2. APIキー形式の確認
```bash
# プロジェクトAPIキーの確認
echo $OPENAI_API_KEY | head -c 8
# 期待値：sk-proj-

# または詳細確認
echo "API Key format: ${OPENAI_API_KEY:0:8}...${OPENAI_API_KEY: -4}"
```

### 3. 権限テスト
```bash
# 権限確認
node test_api_permissions.js
```

## ⚠️ よくある問題

### 問題1: ECONNRESETエラー（ファイルアップロード）
**原因**: 課金設定未完了またはファイルアップロード権限なし
**解決手順**: 
1. **課金設定の確認**: `docs/openai-billing-setup.md` を参照
2. **アカウント状況確認**: `node check_account_status.js` を実行
3. **支払い方法設定**: OpenAI Platform > Billing > Payment methods
4. **使用量制限確認**: 月額制限に達していないか確認

### 問題2: 401 Unauthorized
**原因**: APIキーが無効または期限切れ
**解決**: 新しいAPIキーを生成

### 問題3: 429 Too Many Requests
**原因**: レート制限に達している
**解決**: 使用量を確認し、プランをアップグレード

## 📞 サポート情報

### OpenAI サポート
- **ヘルプセンター**: https://help.openai.com/
- **コミュニティ**: https://community.openai.com/
- **API ドキュメント**: https://platform.openai.com/docs/

### 緊急時の対応
1. APIキーの無効化
2. 新しいAPIキーの生成
3. 環境変数の更新
4. アプリケーションの再起動

## 🔍 デバッグコマンド

```bash
# APIキー確認
echo "API Key: ${OPENAI_API_KEY:0:7}...${OPENAI_API_KEY: -4}"

# 接続テスト
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# Whisper API権限確認
node -e "
const OpenAI = require('openai');
const openai = new OpenAI();
openai.models.list().then(r => console.log('✅ API接続成功'));
"
```