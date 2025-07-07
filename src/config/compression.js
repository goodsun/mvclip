// 圧縮設定の管理
export const compressionLevels = {
  // 高品質（ファイルサイズ大）
  high: {
    name: '高品質',
    video: {
      codec: 'libx264',
      preset: 'slow',
      crf: 12,
      pixelFormat: 'yuv420p'
    },
    audio: {
      codec: 'aac',
      bitrate: '320k',
      sampleRate: '48000'
    },
    analysisAudio: {
      codec: 'mp3',
      channels: 1,
      sampleRate: '22050',
      bitrate: '128k'
    }
  },
  
  // 中品質（バランス）
  medium: {
    name: '中品質',
    video: {
      codec: 'libx264',
      preset: 'medium',
      crf: 15,
      pixelFormat: 'yuv420p'
    },
    audio: {
      codec: 'aac',
      bitrate: '256k',
      sampleRate: '48000'
    },
    analysisAudio: {
      codec: 'mp3',
      channels: 1,
      sampleRate: '22050',
      bitrate: '96k'
    }
  },
  
  // 低品質（ファイルサイズ小）
  low: {
    name: '低品質',
    video: {
      codec: 'libx264',
      preset: 'fast',
      crf: 20,
      pixelFormat: 'yuv420p'
    },
    audio: {
      codec: 'aac',
      bitrate: '192k',
      sampleRate: '44100'
    },
    analysisAudio: {
      codec: 'mp3',
      channels: 1,
      sampleRate: '16000',
      bitrate: '64k'
    }
  }
};

// デフォルト設定
export const defaultCompressionLevel = 'medium';

// 圧縮設定を取得
export function getCompressionSettings(level = defaultCompressionLevel) {
  const settings = compressionLevels[level];
  if (!settings) {
    console.warn(`未知の圧縮レベル: ${level}. デフォルトを使用します。`);
    return compressionLevels[defaultCompressionLevel];
  }
  return settings;
}

// 動画処理用のFFmpegコマンドを生成
export function generateVideoCommand(inputPath, outputPath, compressionLevel = defaultCompressionLevel, subtitlePath = null, font = 'sans-serif') {
  const settings = getCompressionSettings(compressionLevel);
  
  let command = `ffmpeg -i "${inputPath}"`;
  
  // 字幕がある場合
  if (subtitlePath) {
    // システムフォントをそのまま使用（フォールバックはArialに設定）
    const ffmpegFont = font || 'Arial';
    
    console.log(`🔤 使用フォント: ${ffmpegFont}`);
    
    command += ` -vf "subtitles=${subtitlePath}:force_style='FontSize=24,FontName=${ffmpegFont},PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=&H80000000&,Outline=2,Shadow=1,MarginV=20'"`;
  }
  
  // 映像設定
  command += ` -c:v ${settings.video.codec} -preset ${settings.video.preset} -crf ${settings.video.crf} -pix_fmt ${settings.video.pixelFormat}`;
  
  // 音声設定
  command += ` -c:a ${settings.audio.codec} -b:a ${settings.audio.bitrate} -ar ${settings.audio.sampleRate}`;
  
  // 出力パス
  command += ` -y "${outputPath}"`;
  
  return command;
}

// 音声解析用のFFmpegコマンドを生成
export function generateAudioCommand(inputPath, outputPath, compressionLevel = defaultCompressionLevel, startTime = null, duration = null) {
  const settings = getCompressionSettings(compressionLevel);
  
  let command = `ffmpeg -i "${inputPath}"`;
  
  // 時間範囲の指定
  if (startTime !== null && startTime > 0) {
    command += ` -ss ${startTime}`;
  }
  if (duration !== null && duration > 0) {
    command += ` -t ${duration}`;
  }
  
  // 音声設定（解析用）
  command += ` -vn -ac ${settings.analysisAudio.channels} -ar ${settings.analysisAudio.sampleRate} -ab ${settings.analysisAudio.bitrate} -acodec ${settings.analysisAudio.codec}`;
  
  // 出力パス
  command += ` -y "${outputPath}"`;
  
  return command;
}

// 圧縮レベルのリストを取得
export function getCompressionLevelList() {
  return Object.keys(compressionLevels).map(key => ({
    key,
    name: compressionLevels[key].name
  }));
}