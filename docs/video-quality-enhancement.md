# 動画画質の向上対策

## 🎯 問題の分析

ダウンロードした動画の画質が期待より低い問題について、以下の要因と対策を実装しました。

## 📋 実装した改善策

### 1. **フォーマット選択の最適化**
```javascript
// 最高品質のフォーマットを手動選択
const bestFormat = formats
  .filter(f => f.hasVideo && f.hasAudio)
  .sort((a, b) => {
    // 解像度を優先、次にビットレートを比較
    const heightDiff = (parseInt(b.height) || 0) - (parseInt(a.height) || 0);
    if (heightDiff !== 0) return heightDiff;
    return (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0);
  })[0];
```

### 2. **利用可能フォーマットの詳細確認**
```javascript
console.log('🎥 上位フォーマット:');
topFormats.forEach((format, i) => {
  console.log(`  ${i + 1}. ${format.height}p, ${format.container}, ${fileSizeInMB}MB`);
});
```

### 3. **品質確認機能**
```javascript
// ダウンロード後にffprobeで実際の品質を確認
console.log(`📊 ダウンロード品質確認:`);
console.log(`   解像度: ${videoStream.width}x${videoStream.height}`);
console.log(`   フレームレート: ${fps}fps`);
console.log(`   コーデック: ${videoStream.codec_name}`);
```

### 4. **User-Agentとヘッダーの最新化**
```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  // その他の最新ヘッダー
}
```

## 🔍 画質が落ちる主な原因

### 1. **YouTube側の制限**
- YouTubeは高画質フォーマットへのアクセスを制限する場合がある
- 古いUser-Agentでは低画質しか取得できない

### 2. **ytdl-coreの選択ロジック**
- `highest`設定でも必ずしも最高画質が選ばれない
- ファイルサイズと品質のバランスで中画質が選ばれることがある

### 3. **フォーマットの複雑性**
- YouTubeには複数の品質オプションが存在
- `audioandvideo`フィルターが制限要因になる場合がある

## 📊 改善の効果

### Before
```
quality: 'highest' → 720p-1080p（不安定）
選択基準: ytdl-coreの自動判定
品質確認: なし
```

### After
```
手動選択: 利用可能な最高解像度を強制選択
選択基準: 解像度 > ビットレート > ファイルサイズ
品質確認: ffprobeで実際の解像度・コーデックを確認
フォールバック: 複数の品質オプションを段階的に試行
```

## 🎬 動画編集用の特別設定

### 1. **解像度優先選択**
- 1080p以上を優先的に選択
- 利用可能な最高解像度を強制取得

### 2. **コーデック最適化**
- H.264/AVC1を優先
- 高ビットレートの選択

### 3. **品質保証**
```javascript
ytdlOptions.quality = [
  'best[height>=1080]',   // 1080p以上を最優先
  'best[height>=720]',    // 720p以上をフォールバック
  'highestvideo+bestaudio', // 最高画質動画+音声
  'highest'               // 最終フォールバック
];
```

## 🔧 トラブルシューティング

### 品質が期待より低い場合
1. **ログを確認**: 利用可能フォーマットと選択結果
2. **動画の元品質**: YouTube動画自体の最高品質を確認
3. **制限の可能性**: 地域制限や年齢制限の影響

### 考えられる制限要因
- **地域制限**: 一部地域では高画質が制限される
- **動画の年齢**: 古い動画は低画質のみの場合がある
- **著作権**: 著作権保護で品質制限される場合がある

この改善により、利用可能な最高品質での動画取得が可能になります。