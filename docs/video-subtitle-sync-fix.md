# 動画と字幕の同期問題の修正

## 🎯 修正内容

### 1. バッファタイムの追加
動画の最後が切れる問題を解決するため、各セグメントの前後に0.2秒のバッファを追加しました。

```javascript
// バッファタイムを追加（前後0.2秒）
const bufferTime = 0.2;
const adjustedStartTime = Math.max(0, startTime - bufferTime);
const adjustedEndTime = endTime + bufferTime;
```

### 2. 字幕タイミングの調整
バッファ分を考慮して字幕の表示タイミングを調整：

```javascript
const adjustedSegment = {
  start: bufferTime,  // 0.2秒後から字幕開始
  end: endTime - startTime + bufferTime,
  text: segment.text
};
```

### 3. 音声同期の改善
FFmpegコマンドに`-async 1`オプションを追加し、音声と映像の同期を保ちます。

### 4. 最終トリミング
結合後、最初の0.2秒をカットしてバッファを除去：

```bash
ffmpeg -i trimmed.mp4 -ss 0.2 -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y output.mp4
```

## 📊 効果

### Before
- 動画の最後が切れる
- 字幕が映像とズレる
- セグメント間で不連続

### After
- 動画が完全に含まれる
- 字幕と映像が正確に同期
- スムーズな結合

## 🔧 パラメータ調整

必要に応じて`bufferTime`を調整できます：

```javascript
const bufferTime = 0.2;  // デフォルト: 0.2秒
// より長いバッファが必要な場合: 0.3 または 0.5
```

## ⚠️ 注意事項

- バッファタイムが長すぎると、前後のセグメントの音声が重複する可能性があります
- 最終的な動画は元のCSVで指定した時間より若干長くなります（バッファ分）