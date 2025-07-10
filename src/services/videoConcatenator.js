/**
 * 動画結合モジュール
 * 既存の動画に新しい動画を前後に結合する機能を提供
 */

import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { updateProjectMetadata } from './projectManager.js';

const execAsync = promisify(exec);

/**
 * 動画・静止画を結合する
 * @param {string} projectId プロジェクトID
 * @param {string} newFilePath 結合するファイルのパス
 * @param {string} position 結合位置 ('prepend' または 'append')
 * @param {string} fileType ファイル種類 ('video' または 'image')
 * @param {number} imageDuration 静止画の場合の表示時間（秒）
 */
export async function concatVideos(projectId, newFilePath, position, fileType = 'video', imageDuration = null) {
    const workdir = path.join(process.cwd(), 'workdir', projectId);
    const currentVideoPath = path.join(workdir, 'video_high.mp4');
    const tempDir = path.join(process.cwd(), 'temp');
    
    // newFilePathが相対パスの場合は絶対パスに変換
    const absoluteNewFilePath = path.isAbsolute(newFilePath) 
        ? newFilePath 
        : path.join(process.cwd(), newFilePath);
    
    let listFilePath, outputPath, normalizedNewVideoPath;
    
    try {
        // tempディレクトリを作成
        await fs.mkdir(tempDir, { recursive: true });
        
        const timestamp = Date.now();
        listFilePath = path.join(tempDir, `concat_list_${timestamp}.txt`);
        outputPath = path.join(tempDir, `concat_output_${timestamp}.mp4`);
        
        const contentType = fileType === 'image' ? '静止画' : '動画';
        const durationText = fileType === 'image' && imageDuration ? `, ${imageDuration}秒` : '';
        console.log(`🔗 ${contentType}結合開始: ${projectId} (${position === 'prepend' ? '前に挿入' : '後ろに追加'}${durationText})`);
        
        // 既存動画の詳細情報を取得
        const currentVideoInfo = await getVideoInfo(currentVideoPath);
        console.log(`📊 動画情報取得完了`);
        
        // 新しいファイルを動画形式に変換・正規化
        normalizedNewVideoPath = path.join(tempDir, `normalized_new_${timestamp}.mp4`);
        const targetFps = 30; // 安定したフレームレート
        
        if (fileType === 'image') {
            console.log('🔧 静止画を動画に変換中...');
            // 静止画から動画を生成
            const convertCmd = `ffmpeg -loop 1 -i "${absoluteNewFilePath}" ` +
                `-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 ` +
                `-t ${imageDuration} ` +
                `-c:v libx264 -pix_fmt yuv420p ` +
                `-vf "scale=${currentVideoInfo.width}:${currentVideoInfo.height}:force_original_aspect_ratio=decrease,pad=${currentVideoInfo.width}:${currentVideoInfo.height}:(ow-iw)/2:(oh-ih)/2" ` +
                `-r ${targetFps} ` +
                `-c:a aac -ar 48000 ` +
                `-preset medium -crf 20 ` +
                `-avoid_negative_ts make_zero ` +
                `-movflags +faststart ` +
                `-shortest ` +
                `-y "${normalizedNewVideoPath}"`;
            
            await execAsync(convertCmd);
            console.log('✅ 静止画の動画変換完了');
        } else {
            console.log('🔧 新しい動画を正規化中...');
            // 動画を既存動画の形式に正規化
            const normalizeCmd = `ffmpeg -i "${absoluteNewFilePath}" ` +
                `-c:v libx264 -c:a aac ` +
                `-vf "scale=${currentVideoInfo.width}:${currentVideoInfo.height}:force_original_aspect_ratio=decrease,pad=${currentVideoInfo.width}:${currentVideoInfo.height}:(ow-iw)/2:(oh-ih)/2" ` +
                `-r ${targetFps} -ar 48000 ` +
                `-preset medium -crf 20 ` +
                `-avoid_negative_ts make_zero ` +
                `-movflags +faststart ` +
                `-y "${normalizedNewVideoPath}"`;
            
            await execAsync(normalizeCmd);
            console.log('✅ 新しい動画の正規化完了');
        }
        
        // 既存動画も30fpsに正規化（フレームレートが30fps以外の場合）
        let normalizedCurrentVideoPath = currentVideoPath;
        if (Math.abs(currentVideoInfo.fps - targetFps) > 0.1) {
            console.log('🔧 既存動画も30fpsに正規化中...');
            normalizedCurrentVideoPath = path.join(tempDir, `normalized_current_${timestamp}.mp4`);
            
            const normalizeCurrentCmd = `ffmpeg -i "${currentVideoPath}" ` +
                `-c:v libx264 -c:a aac ` +
                `-r ${targetFps} -ar 48000 ` +
                `-preset medium -crf 20 ` +
                `-avoid_negative_ts make_zero ` +
                `-movflags +faststart ` +
                `-y "${normalizedCurrentVideoPath}"`;
            
            console.log('🔧 既存動画正規化中...');
            await execAsync(normalizeCurrentCmd);
            console.log('✅ 既存動画の正規化完了');
        }
        
        
        // 正規化後の動画でリストファイルを更新
        let listContent;
        if (position === 'prepend') {
            // 新しい動画を前に
            listContent = `file '${normalizedNewVideoPath}'\nfile '${normalizedCurrentVideoPath}'`;
        } else {
            // 新しい動画を後ろに
            listContent = `file '${normalizedCurrentVideoPath}'\nfile '${normalizedNewVideoPath}'`;
        }
        
        await fs.writeFile(listFilePath, listContent);
        
        // 30fps統一済み動画同士なのでストリームコピーで高速結合
        const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${listFilePath}" ` +
            `-c copy ` +
            `-avoid_negative_ts make_zero ` +
            `-movflags +faststart ` +
            `-y "${outputPath}"`;
        
        console.log('🔧 FFmpeg結合コマンド実行中...');
        
        await execAsync(ffmpegCmd);
        
        // 元の動画ファイルをバックアップ
        const backupPath = path.join(workdir, `video_high_backup_${timestamp}.mp4`);
        await fs.copyFile(currentVideoPath, backupPath);
        
        // 結合された動画で元のファイルを置き換え
        
        await fs.copyFile(outputPath, currentVideoPath);
        
        // 動画情報を更新
        const stats = await fs.stat(currentVideoPath);
        const duration = await getVideoDuration(currentVideoPath);
        
        // プロジェクトメタデータを更新
        await updateProjectMetadata(projectId, {
            filesize: stats.size,
            duration: duration,
            updatedAt: new Date().toISOString(),
            'files.highQuality.size': stats.size,
            'files.highQuality.updated': new Date().toISOString(),
            lastConcatenation: {
                timestamp: new Date().toISOString(),
                position: position,
                backupPath: backupPath
            }
        });
        
        // 解析用動画も削除（再圧縮が必要）
        const analysisPath = path.join(workdir, 'video_analysis.mp4');
        try {
            await fs.access(analysisPath);
            await fs.unlink(analysisPath);
            console.log('🗑️ 解析用動画を削除（再圧縮が必要）');
            
            // 解析用ファイル情報をクリア
            await updateProjectMetadata(projectId, {
                'files.analysis': null
            });
        } catch {
            // 解析用動画が存在しない場合は無視
        }
        
        // 一時ファイルを削除
        await fs.unlink(listFilePath);
        await fs.unlink(outputPath);
        await fs.unlink(normalizedNewVideoPath);
        if (normalizedCurrentVideoPath !== currentVideoPath) {
            await fs.unlink(normalizedCurrentVideoPath);
        }
        
        console.log(`✅ ${contentType}結合完了: ${projectId}`);
        
        return {
            success: true,
            backupPath: backupPath,
            newDuration: duration,
            newFileSize: stats.size
        };
        
    } catch (error) {
        console.error('動画結合エラー:', error);
        
        // エラー時は一時ファイルを削除
        try {
            await fs.unlink(listFilePath).catch(() => {});
            await fs.unlink(outputPath).catch(() => {});
            if (normalizedNewVideoPath) {
                await fs.unlink(normalizedNewVideoPath).catch(() => {});
            }
            if (normalizedCurrentVideoPath && normalizedCurrentVideoPath !== currentVideoPath) {
                await fs.unlink(normalizedCurrentVideoPath).catch(() => {});
            }
        } catch {}
        
        throw new Error(`動画結合に失敗しました: ${error.message}`);
    }
}

/**
 * FFprobeを使用して動画の詳細情報を取得
 * @param {string} videoPath 動画ファイルのパス
 * @returns {Promise<Object>} 動画の詳細情報
 */
async function getVideoInfo(videoPath) {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
        );
        
        const info = JSON.parse(stdout);
        const videoStream = info.streams.find(stream => stream.codec_type === 'video');
        const format = info.format;
        
        if (!videoStream) {
            throw new Error('動画ストリームが見つかりません');
        }
        
        // フレームレートを計算
        let fps = 30; // デフォルト
        if (videoStream.r_frame_rate) {
            const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
            if (den && den !== 0) {
                fps = num / den;
            }
        } else if (videoStream.avg_frame_rate) {
            const [num, den] = videoStream.avg_frame_rate.split('/').map(Number);
            if (den && den !== 0) {
                fps = num / den;
            }
        }
        
        return {
            duration: parseFloat(format.duration) || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: Math.round(fps * 100) / 100, // 小数点以下2桁
            codec: videoStream.codec_name || 'unknown',
            bitrate: parseInt(format.bit_rate) || 0
        };
        
    } catch (error) {
        console.error('動画情報取得エラー:', error);
        // エラー時はデフォルト値を返す
        return {
            duration: 0,
            width: 0,
            height: 0,
            fps: 30,
            codec: 'unknown',
            bitrate: 0
        };
    }
}

/**
 * FFprobeを使用して動画の長さを取得
 * @param {string} videoPath 動画ファイルのパス
 * @returns {Promise<number>} 動画の長さ（秒）
 */
async function getVideoDuration(videoPath) {
    const info = await getVideoInfo(videoPath);
    return info.duration;
}

/**
 * プロジェクトのバックアップファイルを削除
 * @param {string} projectId プロジェクトID
 * @param {string} backupPath バックアップファイルのパス
 */
export async function deleteBackup(projectId, backupPath) {
    try {
        await fs.unlink(backupPath);
        
        // メタデータからバックアップ情報を削除
        await updateProjectMetadata(projectId, {
            'lastConcatenation.backupPath': null
        });
        
    } catch (error) {
        console.error('バックアップファイル削除エラー:', error);
        throw error;
    }
}