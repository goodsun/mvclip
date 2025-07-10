import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

// 時間文字列を秒数に変換
function parseTimeToSeconds(timeString) {
    const parts = timeString.split(':');
    let seconds = 0;
    
    if (parts.length === 3) {
        // HH:MM:SS.sss format
        const [hours, minutes, secondsWithMs] = parts;
        const [sec, ms] = secondsWithMs.split('.');
        seconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(sec);
        if (ms) {
            seconds += parseInt(ms.padEnd(3, '0')) / 1000;
        }
    } else if (parts.length === 2) {
        // MM:SS.sss format
        const [minutes, secondsWithMs] = parts;
        const [sec, ms] = secondsWithMs.split('.');
        seconds = parseInt(minutes) * 60 + parseInt(sec);
        if (ms) {
            seconds += parseInt(ms.padEnd(3, '0')) / 1000;
        }
    }
    
    return seconds;
}

export async function cropVideo(inputPath, startTime, endTime, progressCallback) {
    return new Promise((resolve, reject) => {
        try {
            // 入力ファイルの存在確認
            fs.access(inputPath).catch(() => {
                reject(new Error('入力動画ファイルが見つかりません'));
                return;
            });

            // 出力ファイルパス
            const outputDir = path.join(process.cwd(), 'temp');
            const outputFilename = `cropped_${Date.now()}.mp4`;
            const outputPath = path.join(outputDir, outputFilename);

            // tempディレクトリが存在しない場合は作成
            fs.mkdir(outputDir, { recursive: true }).catch(console.error);

            // 開始時間と終了時間を秒数に変換
            const startSeconds = parseTimeToSeconds(startTime);
            const endSeconds = parseTimeToSeconds(endTime);
            const duration = endSeconds - startSeconds;

            console.log(`🎬 動画クロップ設定:`);
            console.log(`  入力: ${inputPath}`);
            console.log(`  出力: ${outputPath}`);
            console.log(`  開始: ${startTime} (${startSeconds}秒)`);
            console.log(`  終了: ${endTime} (${endSeconds}秒)`);
            console.log(`  長さ: ${duration}秒`);

            if (duration <= 0) {
                reject(new Error('無効な時間範囲です'));
                return;
            }

            progressCallback(10, 'クロップ処理を開始しています...');

            // 正規化済みファイルのためストリームコピーで高速処理
            const command = ffmpeg(inputPath)
                .seekInput(startSeconds)
                .duration(duration)
                .output(outputPath)
                .videoCodec('copy')
                .audioCodec('copy')
                .outputOptions([
                    '-avoid_negative_ts', 'make_zero',
                    '-movflags', '+faststart'
                ]);

            command.on('start', (commandLine) => {
                console.log('FFmpeg開始:', commandLine);
                progressCallback(20, 'クロップ処理中...');
            });

            command.on('progress', (progress) => {
                const percent = Math.min(90, 20 + (progress.percent || 0) * 0.7);
                progressCallback(percent, `クロップ処理中... ${Math.round(progress.percent || 0)}%`);
            });

            command.on('end', () => {
                console.log('✅ 動画クロップ完了:', outputPath);
                progressCallback(100, 'クロップ完了');
                resolve(outputPath);
            });

            command.on('error', (error) => {
                console.error('❌ 動画クロップエラー:', error);
                progressCallback(0, `エラー: ${error.message}`);
                reject(new Error(`動画クロップに失敗しました: ${error.message}`));
            });

            command.run();

        } catch (error) {
            console.error('❌ 動画クロップ初期化エラー:', error);
            reject(error);
        }
    });
}