/**
 * ローカルファイル処理モジュール
 * ローカル動画ファイルからプロジェクトを作成する機能を提供
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createProject, updateProjectMetadata } from './projectManager.js';
// 解析用動画圧縮は独自実装

const execAsync = promisify(exec);

/**
 * ローカル動画ファイルからプロジェクトを作成
 * @param {string} filePath アップロードされたファイルのパス
 * @param {string} originalName 元のファイル名
 * @param {string} projectName プロジェクト名
 * @param {Function} progressCallback 進捗コールバック関数
 * @returns {Promise<Object>} 作成されたプロジェクト情報
 */
export async function createLocalProject(filePath, originalName, projectName, progressCallback) {
    const projectId = generateVideoId(originalName);
    const workdir = path.join(process.cwd(), 'workdir', projectId);
    
    try {
        progressCallback('upload', 10, 'ファイルを処理中...');
        
        // 作業ディレクトリを作成
        await fs.mkdir(workdir, { recursive: true });
        
        progressCallback('upload', 20, '動画情報を取得中...');
        
        // FFprobeで動画情報を取得
        const videoInfo = await getVideoInfo(filePath);
        
        progressCallback('upload', 30, 'プロジェクトファイルを作成中...');
        
        // プロジェクト情報を作成
        const videoInfo_formatted = {
            title: projectName,
            duration: videoInfo.duration,
            url: `local:${originalName}`
        };
        
        // プロジェクトを作成
        await createProject(projectId, videoInfo_formatted);
        
        progressCallback('upload', 40, '高画質版を配置中...');
        
        // 高画質版として元ファイルをコピー
        const highQualityPath = path.join(workdir, 'video_high.mp4');
        await fs.copyFile(filePath, highQualityPath);
        
        // プロジェクトメタデータを更新
        await updateProjectMetadata(projectId, {
            'files.highQuality': {
                path: highQualityPath,
                size: videoInfo.filesize,
                created: new Date().toISOString()
            },
            isLocalFile: true,
            originalFilename: originalName,
            resolution: videoInfo.resolution,
            filesize: videoInfo.filesize
        });
        
        progressCallback('upload', 60, '解析用動画を圧縮中...');
        
        // 解析用動画を圧縮
        progressCallback('compressing', 70, '解析用動画を圧縮中...');
        
        const analysisPath = path.join(workdir, 'video_analysis.mp4');
        
        // FFmpegで圧縮（480p、低ビットレート、音声認識に十分な品質）
        const ffmpegCmd = `ffmpeg -i "${highQualityPath}" ` +
            `-vf "scale=-2:480" ` +
            `-c:v libx264 -preset fast -crf 28 ` +
            `-c:a aac -b:a 128k -ar 44100 ` +
            `-movflags +faststart ` +
            `-y "${analysisPath}"`;
        
        await execAsync(ffmpegCmd);
        
        progressCallback('upload_complete', 95, '解析用動画の圧縮が完了しました');
        
        // ファイルサイズを取得
        const analysisStats = await fs.stat(analysisPath);
        
        // プロジェクトメタデータを最終更新
        await updateProjectMetadata(projectId, {
            'files.analysis': {
                path: analysisPath,
                size: analysisStats.size,
                created: new Date().toISOString()
            }
        });
        
        progressCallback('completed', 100, 'ローカルファイルプロジェクトの作成が完了しました');
        
        return {
            success: true,
            projectId
        };
        
    } catch (error) {
        console.error('ローカルファイルプロジェクト作成エラー:', error);
        
        // エラー時は作業ディレクトリを削除
        try {
            await fs.rm(workdir, { recursive: true, force: true });
        } catch (cleanupError) {
            console.error('クリーンアップエラー:', cleanupError);
        }
        
        throw new Error(`ローカルファイルプロジェクトの作成に失敗しました: ${error.message}`);
    }
}

/**
 * ファイル名から動画IDを生成
 * @param {string} filename ファイル名
 * @returns {string} 生成された動画ID
 */
function generateVideoId(filename) {
    const nameWithoutExt = path.parse(filename).name;
    const sanitized = nameWithoutExt.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const uuid = uuidv4().substr(0, 8);
    return `local_${sanitized}_${uuid}`;
}

/**
 * FFprobeを使用して動画情報を取得
 * @param {string} filePath 動画ファイルのパス
 * @returns {Promise<Object>} 動画情報
 */
async function getVideoInfo(filePath) {
    try {
        const { stdout } = await execAsync(
            `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
        );
        
        const info = JSON.parse(stdout);
        const videoStream = info.streams.find(stream => stream.codec_type === 'video');
        const format = info.format;
        
        if (!videoStream) {
            throw new Error('動画ストリームが見つかりません');
        }
        
        // ファイルサイズを取得
        const stats = await fs.stat(filePath);
        
        return {
            duration: parseFloat(format.duration) || 0,
            resolution: `${videoStream.width}x${videoStream.height}`,
            filesize: stats.size,
            codec: videoStream.codec_name,
            bitrate: parseInt(format.bit_rate) || 0
        };
        
    } catch (error) {
        console.error('動画情報取得エラー:', error);
        throw new Error(`動画情報の取得に失敗しました: ${error.message}`);
    }
}