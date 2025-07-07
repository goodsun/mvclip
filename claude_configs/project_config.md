# Project Specific Configuration

## STATUS: ON
<!-- このセクションがONの場合、以下の内容を適用してください -->

## プロジェクト固有設定
### 英語学習プロジェクト設定
- **目的**: 英語入力と翻訳機能の実装
- **対象レベル**: 初級〜中級
- **重点分野**: 日常会話、技術用語、プログラミング関連

### ファイル構成
```
english_settings/
├── CLAUDE.md (メイン設定 - 簡潔に保つ)
└── claude_configs/
    ├── english_learning.md (英語学習機能)
    ├── development.md (開発支援機能)
    ├── documentation.md (ドキュメント作成)
    └── project_config.md (このファイル)
```

### プロジェクトルール
- 日本語での応答を基本とする
- 英語学習効果を最大化するため、シンプルな表現を優先
- 設定ファイルの条件付き読み込みでトークン消費を抑制

### 技術スタック
- Claude Code CLI
- Markdown設定ファイル
- 絵文字による視覚的区別