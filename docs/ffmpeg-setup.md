# FFmpeg セットアップガイド

## 🎯 概要

y2clipの動画編集機能（字幕合成）には、**字幕フィルター対応のFFmpeg**が必要です。古いFFmpegには`libass`（字幕ライブラリ）が含まれていない場合があります。

## 🔍 現在の問題

### エラー例
```
[AVFilterGraph @ 0x7fa4321061e0] No such filter: 'subtitles'
Error reinitializing filters!
Failed to inject frame into filter network: Invalid argument
```

### 原因
- **古いFFmpeg**: バージョン3.4（2017年）
- **libass未対応**: 字幕フィルターが利用できない
- **Homebrewの古いインストール**: 最新版への更新が必要

## 🚀 解決方法：FFmpegアップグレード

### 1. 現在のバージョン確認
```bash
# 現在のFFmpegバージョンを確認
ffmpeg -version

# Homebrewでインストールされた情報を確認
brew info ffmpeg
```

### 2. 古いFFmpegの削除
```bash
# 既存のFFmpegを完全削除
brew uninstall --force --ignore-dependencies ffmpeg

# 念のため古いファイルが残っていないか確認
which ffmpeg
# 何も表示されなければOK
```

### 3. 最新FFmpegのインストール
```bash
# pkg-configが必要（libass検出用）
brew install pkg-config

# 最新FFmpegをインストール（libass標準搭載）
brew install ffmpeg
```

### 4. インストール確認
```bash
# バージョン確認（7.x.x が表示されるはず）
ffmpeg -version

# libass対応確認
ffmpeg -version | grep -i libass
# または
ffmpeg -filters | grep subtitles
```

## ✅ 成功確認

### 期待される結果
```bash
$ ffmpeg -version
ffmpeg version 7.1.1 Copyright (c) 2000-2024 the FFmpeg developers
built with Apple clang version 15.0.0 (clang-1500.3.9.4)
configuration: --prefix=/usr/local/Cellar/ffmpeg/7.1.1 --enable-shared --enable-pthreads --enable-version3 --cc=clang --host-cflags= --host-ldflags= --enable-ffplay --enable-gnutls --enable-gpl --enable-libaom --enable-libaribb24 --enable-libass --enable-libbluray --enable-libdav1d --enable-libharfbuzz --enable-libjxl --enable-libmp3lame --enable-libopus --enable-librav1e --enable-librist --enable-librubberband --enable-libsnappy --enable-libsrt --enable-libsvtav1 --enable-libtesseract --enable-libtheora --enable-libvidstab --enable-libvmaf --enable-libvorbis --enable-libvpx --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxml2 --enable-libxvid --enable-lzma --enable-libfontconfig --enable-libfreetype --enable-frei0r --enable-libsoxr --enable-libspeex --enable-libopencore-amrnb --enable-libopencore-amrwb --enable-libopenjpeg --enable-libzmq --enable-videotoolbox --disable-libjack --disable-indev=jack
```

重要な設定：
- ✅ `--enable-libass`: 字幕ライブラリ有効
- ✅ `--enable-libfontconfig`: フォント管理
- ✅ `--enable-libfreetype`: フォントレンダリング

### 字幕フィルター確認
```bash
$ ffmpeg -filters | grep subtitles
subtitles           V->V       Render text subtitles onto input video.
```

## 📝 y2clipでのテスト

### 字幕機能テスト
```bash
# プロジェクトディレクトリで
npm start

# ブラウザで http://localhost:3000 にアクセス
# 動画編集モードで字幕付き動画を作成
```

### 期待される動作
1. ✅ 字幕解析モード: YouTube動画 → CSV生成
2. ✅ 動画編集モード: CSV + 動画 → 字幕付き切り抜き動画

## 🔧 トラブルシューティング

### 問題1: `No such filter: 'subtitles'`
```bash
# 解決策: FFmpegを最新版に更新
brew uninstall --force ffmpeg
brew install ffmpeg
```

### 問題2: `libass not found`
```bash
# 解決策: pkg-configをインストール
brew install pkg-config
brew reinstall ffmpeg
```

### 問題3: 古いバージョンが残っている
```bash
# パスの確認
echo $PATH

# Homebrewのパスが優先されているか確認
which ffmpeg
# /usr/local/bin/ffmpeg または /opt/homebrew/bin/ffmpeg

# 必要に応じてパスを調整
export PATH="/usr/local/bin:$PATH"
```

### 問題4: フォント関連エラー
```bash
# 日本語フォントの確認（macOS）
fc-list :lang=ja

# フォントがない場合
brew install fontconfig
# システムフォントの再読み込み
fc-cache -f -v
```

## 📊 アップグレード効果

### Before（FFmpeg 3.4）
- ❌ 字幕フィルター未対応
- ❌ libass未搭載
- ❌ 動画編集機能エラー

### After（FFmpeg 7.1.1）
- ✅ 字幕フィルター対応
- ✅ libass搭載
- ✅ 動画編集機能正常動作
- ✅ 最新コーデック対応
- ✅ 高速処理

## 🌟 追加の恩恵

### 新機能・改善
- **AV1サポート**: より効率的な動画圧縮
- **HDR対応**: 高品質動画処理
- **ハードウェアアクセラレーション**: GPU活用
- **字幕スタイル**: 豊富なカスタマイズオプション

### 字幕スタイリング例
```bash
# 高度な字幕スタイル設定
-vf "subtitles=subtitle.srt:force_style='FontSize=24,FontName=Hiragino Sans,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=&H80000000&,Outline=2,Shadow=1,MarginV=20'"
```

## 📚 参考資料

- **FFmpeg公式**: https://ffmpeg.org/
- **字幕フィルターガイド**: https://trac.ffmpeg.org/wiki/HowToBurnSubtitlesIntoVideo
- **Homebrew FFmpeg**: https://formulae.brew.sh/formula/ffmpeg
- **libass公式**: https://github.com/libass/libass

## ⚠️ 注意事項

### 互換性
- **macOS**: 10.15以降推奨
- **Homebrew**: 最新版が必要
- **Xcode Command Line Tools**: 必須

### パフォーマンス
- 最新FFmpegは処理速度が大幅向上
- メモリ使用量の最適化
- マルチスレッド処理の改善