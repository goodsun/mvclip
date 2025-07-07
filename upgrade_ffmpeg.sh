#!/bin/bash

echo "🎬 FFmpeg字幕対応版アップグレード開始..."

# 現在のバージョン確認
echo "📋 現在のFFmpegバージョン:"
ffmpeg -version 2>/dev/null | head -1 || echo "FFmpegがインストールされていません"

# 既存のFFmpegを削除
echo "🗑️ 古いFFmpegを削除中..."
brew uninstall --force --ignore-dependencies ffmpeg 2>/dev/null || echo "削除対象なし"

# pkg-configのインストール
echo "📦 pkg-configをインストール中..."
brew install pkg-config

# 最新FFmpegのインストール
echo "⬇️ 最新FFmpeg（libass搭載）をインストール中..."
brew install ffmpeg

# インストール確認
echo "✅ インストール完了確認:"
echo "📋 新しいFFmpegバージョン:"
ffmpeg -version | head -1

echo "🔍 libass対応確認:"
if ffmpeg -version | grep -q "enable-libass"; then
    echo "   ✅ libass: 対応済み"
else
    echo "   ❌ libass: 未対応"
fi

echo "🎭 字幕フィルター確認:"
if ffmpeg -filters 2>/dev/null | grep -q "subtitles"; then
    echo "   ✅ subtitles filter: 利用可能"
else
    echo "   ❌ subtitles filter: 利用不可"
fi

echo "🎉 FFmpegアップグレード完了！"
echo "💡 動画編集モードで字幕合成をテストしてください"