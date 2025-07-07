import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// プロジェクトのベースディレクトリ
const WORKDIR = path.join(__dirname, '../../workdir');

// プロジェクト構造の例:
// workdir/
//   └── jy7He1dOoMI/
//       ├── project.json (メタデータ)
//       ├── video_high.mp4 (高画質版)
//       ├── video_analysis.mp4 (解析用)
//       └── subtitles.csv

export async function initializeWorkdir() {
  try {
    await fs.mkdir(WORKDIR, { recursive: true });
    console.log('✅ Workdir初期化完了:', WORKDIR);
  } catch (error) {
    console.error('Workdir初期化エラー:', error);
  }
}

export async function createProject(videoId, videoInfo, timeRange = null) {
  const projectPath = path.join(WORKDIR, videoId);
  
  try {
    // プロジェクトディレクトリを作成
    await fs.mkdir(projectPath, { recursive: true });
    
    // プロジェクトメタデータを保存
    const metadata = {
      videoId,
      title: videoInfo.title,
      duration: videoInfo.duration,
      url: videoInfo.url,
      timeRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'downloading',
      analysisRange: null // 解析範囲の保存用
    };
    
    await fs.writeFile(
      path.join(projectPath, 'project.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log(`📁 プロジェクト作成: ${videoId}`);
    return projectPath;
  } catch (error) {
    console.error('プロジェクト作成エラー:', error);
    throw error;
  }
}

export async function getProject(videoId) {
  const projectPath = path.join(WORKDIR, videoId);
  
  try {
    const metadataPath = path.join(projectPath, 'project.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    // ファイルの存在確認
    const files = await fs.readdir(projectPath);
    const hasHighQuality = files.includes('video_high.mp4');
    const hasAnalysis = files.includes('video_analysis.mp4');
    const hasSubtitles = files.includes('subtitles.csv');
    
    return {
      ...metadata,
      projectPath,
      files: {
        highQuality: hasHighQuality ? path.join(projectPath, 'video_high.mp4') : null,
        analysis: hasAnalysis ? path.join(projectPath, 'video_analysis.mp4') : null,
        subtitles: hasSubtitles ? path.join(projectPath, 'subtitles.csv') : null
      }
    };
  } catch (error) {
    console.error('プロジェクト取得エラー:', error);
    return null;
  }
}

export async function updateProjectStatus(videoId, status) {
  const projectPath = path.join(WORKDIR, videoId);
  
  try {
    const metadataPath = path.join(projectPath, 'project.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    metadata.status = status;
    metadata.updatedAt = new Date().toISOString();
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`📊 プロジェクトステータス更新: ${videoId} → ${status}`);
  } catch (error) {
    console.error('プロジェクトステータス更新エラー:', error);
  }
}

export async function updateAnalysisRange(videoId, analysisRange) {
  const projectPath = path.join(WORKDIR, videoId);
  
  try {
    const metadataPath = path.join(projectPath, 'project.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    
    metadata.analysisRange = analysisRange;
    metadata.updatedAt = new Date().toISOString();
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`🔍 解析範囲更新: ${videoId} → ${analysisRange ? `${analysisRange.start || '0:00'} - ${analysisRange.end || 'END'}` : '全体'}`);
  } catch (error) {
    console.error('解析範囲更新エラー:', error);
    throw error;
  }
}

export async function saveProjectFile(videoId, filename, sourcePath) {
  const projectPath = path.join(WORKDIR, videoId);
  const destPath = path.join(projectPath, filename);
  
  try {
    await fs.copyFile(sourcePath, destPath);
    console.log(`💾 ファイル保存: ${filename} → ${videoId}`);
    return destPath;
  } catch (error) {
    console.error('ファイル保存エラー:', error);
    throw error;
  }
}

export async function saveCSVContent(videoId, csvContent) {
  const projectPath = path.join(WORKDIR, videoId);
  const csvPath = path.join(projectPath, 'subtitles.csv');
  
  try {
    await fs.writeFile(csvPath, csvContent, 'utf8');
    console.log(`📄 CSV保存: ${videoId} → subtitles.csv`);
    return csvPath;
  } catch (error) {
    console.error('CSV保存エラー:', error);
    throw error;
  }
}

export async function getCSVContent(videoId) {
  const projectPath = path.join(WORKDIR, videoId);
  const csvPath = path.join(projectPath, 'subtitles.csv');
  
  try {
    const content = await fs.readFile(csvPath, 'utf8');
    return content;
  } catch (error) {
    console.error('CSV読み込みエラー:', error);
    return null;
  }
}

export async function listProjects() {
  try {
    // WORKDIR が存在しない場合のみ作成
    try {
      await fs.access(WORKDIR);
    } catch {
      await fs.mkdir(WORKDIR, { recursive: true });
    }
    
    const dirs = await fs.readdir(WORKDIR);
    const projects = [];
    
    for (const dir of dirs) {
      // .DS_Store などの隠しファイルをスキップ
      if (dir.startsWith('.')) {
        continue;
      }
      
      // ディレクトリかどうかを確認
      const dirPath = path.join(WORKDIR, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }
      
      const project = await getProject(dir);
      if (project) {
        projects.push(project);
      }
    }
    
    // 更新日時で降順ソート
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    return projects;
  } catch (error) {
    console.error('プロジェクト一覧取得エラー:', error);
    return [];
  }
}

export async function deleteProject(videoId) {
  const projectPath = path.join(WORKDIR, videoId);
  
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    console.log(`🗑️ プロジェクト削除: ${videoId}`);
  } catch (error) {
    console.error('プロジェクト削除エラー:', error);
    throw error;
  }
}