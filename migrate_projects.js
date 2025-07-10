#!/usr/bin/env node

/**
 * 既存プロジェクトのproject.jsonを新しい統一形式に移行するスクリプト
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKDIR = path.join(__dirname, 'workdir');

async function migrateProject(projectDir) {
    const projectJsonPath = path.join(projectDir, 'project.json');
    
    try {
        const content = await fs.readFile(projectJsonPath, 'utf8');
        const project = JSON.parse(content);
        
        // 既に新形式の場合はスキップ
        if (project.displayInfo) {
            console.log(`📦 ${project.videoId}: 既に新形式です`);
            return false;
        }
        
        console.log(`🔄 ${project.videoId}: 移行中...`);
        
        // 新しい統一形式に変換
        const migratedProject = {
            videoId: project.videoId,
            title: project.title,
            duration: project.duration,
            durationText: project.duration ? `${Math.floor(project.duration / 60)}:${String(project.duration % 60).padStart(2, '0')}` : '-',
            url: project.url,
            status: project.status || 'ready',
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            
            // 統一された表示情報
            displayInfo: {
                title: project.title || `動画_${project.videoId}`,
                url: project.url || '',
                duration: project.duration || 0,
                durationText: project.duration ? `${Math.floor(project.duration / 60)}:${String(project.duration % 60).padStart(2, '0')}` : '-',
                videoId: project.videoId,
                description: '',
                uploadDate: null,
                uploader: '-',
                uploaderUrl: null,
                viewCount: 0,
                likeCount: 0,
                resolution: '-',
                fps: 0,
                format: '-',
                filesize: null,
                filesizeText: '-',
                thumbnail: null,
                categories: [],
                tags: [],
                createdAt: project.createdAt || new Date().toISOString()
            },
            
            // 既存のフィールドを保持
            timeRange: project.timeRange || null,
            analysisRange: project.analysisRange || null
        };
        
        // videoMetadataがある場合は統合
        if (project.videoMetadata) {
            Object.assign(migratedProject.displayInfo, {
                filesize: project.videoMetadata.filesize,
                filesizeText: project.videoMetadata.filesizeText || '-'
            });
        }
        
        // バックアップを作成
        const backupPath = projectJsonPath + '.backup';
        await fs.copyFile(projectJsonPath, backupPath);
        
        // 新しい形式で保存
        await fs.writeFile(projectJsonPath, JSON.stringify(migratedProject, null, 2));
        
        console.log(`✅ ${project.videoId}: 移行完了`);
        return true;
        
    } catch (error) {
        console.error(`❌ ${path.basename(projectDir)}: 移行失敗 - ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🚀 プロジェクト移行スクリプト開始');
    
    try {
        const entries = await fs.readdir(WORKDIR);
        let migrated = 0;
        let skipped = 0;
        let failed = 0;
        
        for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            
            const projectDir = path.join(WORKDIR, entry);
            const stats = await fs.stat(projectDir);
            
            if (stats.isDirectory()) {
                const result = await migrateProject(projectDir);
                if (result === true) {
                    migrated++;
                } else if (result === false) {
                    skipped++;
                } else {
                    failed++;
                }
            }
        }
        
        console.log('\n📊 移行結果:');
        console.log(`   移行済み: ${migrated}個`);
        console.log(`   スキップ: ${skipped}個`);
        console.log(`   失敗: ${failed}個`);
        
        if (migrated > 0) {
            console.log('\n💡 バックアップファイル (*.backup) が作成されました');
            console.log('   問題がなければ、以下のコマンドで削除できます:');
            console.log(`   find ${WORKDIR} -name "*.backup" -delete`);
        }
        
    } catch (error) {
        console.error('❌ 移行処理でエラーが発生しました:', error);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみ実行
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}