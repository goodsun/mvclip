import fs from 'fs/promises';
import path from 'path';
import { updateProjectMetadata } from './projectManager.js';

// 動画の継続時間を取得するヘルパー関数
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

export async function createCropProject({
    originalProjectId,
    croppedVideoPath,
    title,
    cropRange,
    originalUrl
}) {
    try {
        // 新しいプロジェクトIDを生成（タイムスタンプベース）
        const projectId = `crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // プロジェクトディレクトリを作成
        const workdir = path.join(process.cwd(), 'workdir');
        const projectPath = path.join(workdir, projectId);
        await fs.mkdir(projectPath, { recursive: true });
        
        // クロップされた動画ファイルを高画質版としてコピー
        const croppedVideoSourcePath = path.join(process.cwd(), 'public', croppedVideoPath.replace('/outputs/', 'outputs/'));
        const highQualityPath = path.join(projectPath, 'video_high.mp4');
        const analysisPath = path.join(projectPath, 'video_analysis.mp4');
        
        // ファイルをコピー
        await fs.copyFile(croppedVideoSourcePath, highQualityPath);
        await fs.copyFile(croppedVideoSourcePath, analysisPath);
        
        // クロップ範囲から継続時間を計算
        let duration = 0;
        if (cropRange && cropRange.start && cropRange.end) {
            const startSeconds = parseTimeToSeconds(cropRange.start);
            const endSeconds = parseTimeToSeconds(cropRange.end);
            duration = Math.round(endSeconds - startSeconds);
        }
        
        // プロジェクトメタデータを作成
        const metadata = {
            videoId: projectId,
            title: title,
            duration: duration,
            url: originalUrl || '',
            timeRange: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'ready',
            analysisRange: null,
            cropInfo: {
                originalProjectId: originalProjectId,
                cropRange: cropRange,
                createdFrom: 'crop'
            }
        };
        
        // project.jsonを保存
        await fs.writeFile(
            path.join(projectPath, 'project.json'),
            JSON.stringify(metadata, null, 2)
        );
        
        console.log(`✅ クロップ動画から新プロジェクト作成完了: ${projectId}`);
        console.log(`   タイトル: ${title}`);
        console.log(`   継続時間: ${duration}秒`);
        console.log(`   元プロジェクト: ${originalProjectId}`);
        
        return {
            projectId: projectId,
            title: title,
            duration: duration,
            projectPath: projectPath
        };
        
    } catch (error) {
        console.error('❌ クロップ動画からの新プロジェクト作成エラー:', error);
        throw new Error(`新プロジェクトの作成に失敗しました: ${error.message}`);
    }
}