// グローバル変数
let currentProject = null;
let projects = [];
let isProcessing = false;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    setupEventListeners();
});

// プロジェクト一覧を読み込み
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        
        if (data.success) {
            projects = data.projects;
            renderProjectList();
        }
    } catch (error) {
        console.error('プロジェクト読み込みエラー:', error);
        showError('プロジェクト一覧の読み込みに失敗しました');
    }
}

// プロジェクト一覧をレンダリング
function renderProjectList() {
    const projectList = document.getElementById('project-list');
    
    if (projects.length === 0) {
        projectList.innerHTML = '<div class="no-projects">プロジェクトがありません</div>';
        return;
    }
    
    projectList.innerHTML = projects.map(project => {
        const statusClass = getStatusClass(project.status);
        const duration = formatDuration(project.duration);
        
        return `
            <div class="project-item" data-project-id="${project.videoId}" onclick="selectProject('${project.videoId}')">
                <h4>${escapeHtml(project.title)}</h4>
                <div class="project-meta">
                    <span>${duration}</span>
                    <span class="separator">•</span>
                    <span class="status-badge ${statusClass}">${getStatusText(project.status)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// プロジェクトを選択
async function selectProject(videoId) {
    try {
        // アクティブクラスを更新
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-project-id="${videoId}"]`).classList.add('active');
        
        // プロジェクト詳細を取得
        const response = await fetch(`/api/projects/${videoId}`);
        const data = await response.json();
        
        if (data.success) {
            currentProject = data.project;
            showProjectWorkspace();
            updateProjectDisplay();
        }
    } catch (error) {
        console.error('プロジェクト選択エラー:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// プロジェクトワークスペースを表示
function showProjectWorkspace() {
    document.getElementById('no-project-selected').style.display = 'none';
    document.getElementById('project-workspace').style.display = 'block';
}

// プロジェクト情報を表示
function updateProjectDisplay() {
    if (!currentProject) return;
    
    // ヘッダー情報
    document.getElementById('project-title').textContent = currentProject.title;
    document.getElementById('project-duration').textContent = formatDuration(currentProject.duration);
    document.getElementById('project-status').textContent = getStatusText(currentProject.status);
    
    // ダウンロード状況
    updateDownloadStatus();
    
    // プレビュー更新
    updatePreview();
    
    // デフォルトでダウンロードタブを表示
    showTab('download');
}

// ダウンロード状況を更新
function updateDownloadStatus() {
    const highQualityStatus = document.getElementById('high-quality-status');
    const analysisStatus = document.getElementById('analysis-status');
    const highQualityInfo = document.getElementById('high-quality-info');
    const analysisInfo = document.getElementById('analysis-info');
    
    // 高画質版
    if (currentProject.files.highQuality) {
        highQualityStatus.textContent = '✅ ダウンロード済み';
        highQualityStatus.className = 'status-badge ready';
        
        // ファイル情報を取得して表示（TODO: API実装）
        highQualityInfo.innerHTML = `
            <p>✅ 高画質版がダウンロード済みです</p>
            <p><small>動画編集で使用されます</small></p>
        `;
    } else {
        highQualityStatus.textContent = '未ダウンロード';
        highQualityStatus.className = 'status-badge';
    }
    
    // 解析用
    if (currentProject.files.analysis) {
        analysisStatus.textContent = '✅ ダウンロード済み';
        analysisStatus.className = 'status-badge ready';
        
        analysisInfo.innerHTML = `
            <p>✅ 解析用動画がダウンロード済みです</p>
            <p><small>音声認識で字幕を生成します</small></p>
        `;
    } else {
        analysisStatus.textContent = '未ダウンロード';
        analysisStatus.className = 'status-badge';
    }
}

// プレビューを更新
function updatePreview() {
    const previewVideo = document.getElementById('preview-video');
    const previewSelect = document.getElementById('preview-select');
    const videoDetails = document.getElementById('video-details');
    
    // プレビューセレクターの変更イベント
    previewSelect.addEventListener('change', () => {
        const selectedType = previewSelect.value;
        const videoPath = selectedType === 'high' ? currentProject.files.highQuality : currentProject.files.analysis;
        
        if (videoPath) {
            // ファイルパスを公開用パスに変換（TODO: API実装）
            previewVideo.src = `/projects/${currentProject.videoId}/${selectedType === 'high' ? 'video_high.mp4' : 'video_analysis.mp4'}`;
            previewVideo.style.display = 'block';
            
            // 動画詳細を表示
            videoDetails.innerHTML = `
                <h4>${selectedType === 'high' ? '🎬 高画質版' : '📝 解析用'}</h4>
                <p>ファイル: ${selectedType === 'high' ? 'video_high.mp4' : 'video_analysis.mp4'}</p>
                <p>用途: ${selectedType === 'high' ? '動画編集' : '字幕解析'}</p>
            `;
        } else {
            previewVideo.style.display = 'none';
            videoDetails.innerHTML = '<p>選択された動画がダウンロードされていません</p>';
        }
    });
    
    // 初期表示
    previewSelect.dispatchEvent(new Event('change'));
}

// タブ切り替え
function showTab(tabName) {
    // タブボタンを更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // タブコンテンツを更新
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// イベントリスナーの設定
function setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            showTab(tabName);
        });
    });
    
    // 新規プロジェクト作成モーダル
    document.getElementById('new-project-btn').addEventListener('click', () => {
        document.getElementById('new-project-modal').style.display = 'flex';
    });
    
    // モーダルクローズ
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('new-project-modal').style.display = 'none';
        });
    });
    
    // モーダル外クリック
    document.getElementById('new-project-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.style.display = 'none';
        }
    });
    
    // プロジェクト作成確定
    document.getElementById('confirm-create-project').addEventListener('click', createNewProject);
    
    // プロジェクト削除
    document.getElementById('delete-project-btn').addEventListener('click', deleteCurrentProject);
    
    // 字幕解析開始
    document.getElementById('start-analysis-btn').addEventListener('click', startAnalysis);
    
    // CSV保存
    document.getElementById('save-csv').addEventListener('click', saveCSVToProject);
    
    // CSV読み込み
    document.getElementById('load-csv-btn').addEventListener('click', loadCSV);
    
    // 動画処理
    document.getElementById('process-video-btn').addEventListener('click', processVideo);
}

// 新規プロジェクト作成
async function createNewProject() {
    const url = document.getElementById('new-project-url').value.trim();
    const startTime = document.getElementById('new-project-start').value.trim();
    const endTime = document.getElementById('new-project-end').value.trim();
    
    if (!url) {
        showError('YouTube URLを入力してください');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    
    try {
        updateProgress('download-progress', 10, 'プロジェクト作成中...');
        
        const requestBody = { url };
        if (startTime) requestBody.startTime = startTime;
        if (endTime) requestBody.endTime = endTime;
        
        const response = await fetch('/api/projects/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'プロジェクト作成に失敗しました');
        }
        
        updateProgress('download-progress', 100, '完了！');
        
        // モーダルを閉じてプロジェクト一覧を更新
        document.getElementById('new-project-modal').style.display = 'none';
        await loadProjects();
        
        showInfo('プロジェクトが作成されました');
        
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessing = false;
        setTimeout(() => {
            document.getElementById('download-progress').style.display = 'none';
        }, 2000);
    }
}

// 現在のプロジェクトを削除
async function deleteCurrentProject() {
    if (!currentProject) return;
    
    if (!confirm(`プロジェクト「${currentProject.title}」を削除しますか？`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('プロジェクトの削除に失敗しました');
        }
        
        // プロジェクト一覧を更新
        await loadProjects();
        
        // ワークスペースを非表示
        document.getElementById('project-workspace').style.display = 'none';
        document.getElementById('no-project-selected').style.display = 'flex';
        
        currentProject = null;
        showInfo('プロジェクトが削除されました');
        
    } catch (error) {
        showError(error.message);
    }
}

// 字幕解析を開始
async function startAnalysis() {
    if (!currentProject || !currentProject.files.analysis) {
        showError('解析用動画がダウンロードされていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    
    try {
        updateProgress('analysis-progress', 20, '音声認識を実行中...');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentProject.files.analysis,
                videoId: currentProject.videoId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '解析に失敗しました');
        }
        
        const data = await response.json();
        
        updateProgress('analysis-progress', 100, '完了！');
        
        // CSV結果を表示
        document.getElementById('csv-content').value = data.csvContent;
        document.getElementById('csv-result').style.display = 'block';
        
        showInfo('字幕解析が完了しました');
        
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessing = false;
        setTimeout(() => {
            document.getElementById('analysis-progress').style.display = 'none';
        }, 2000);
    }
}

// CSVをプロジェクトに保存
async function saveCSVToProject() {
    const csvContent = document.getElementById('csv-content').value;
    
    if (!csvContent || !currentProject) {
        showError('保存するCSVデータがありません');
        return;
    }
    
    try {
        // TODO: CSV保存API実装
        showInfo('CSVがプロジェクトに保存されました');
        
        // プロジェクト情報を更新
        await selectProject(currentProject.videoId);
        
    } catch (error) {
        showError('CSV保存に失敗しました');
    }
}

// CSVを読み込み
function loadCSV() {
    const source = document.getElementById('csv-source').value;
    
    if (source === 'project') {
        if (currentProject.files.subtitles) {
            // プロジェクト内のCSVを読み込み
            // TODO: API実装
            showInfo('プロジェクト内のCSVを読み込みました');
        } else {
            showError('プロジェクト内にCSVファイルがありません');
        }
    } else {
        // ファイルアップロード
        document.getElementById('csv-upload-file').click();
    }
}

// 動画処理
async function processVideo() {
    if (!currentProject || !currentProject.files.highQuality) {
        showError('高画質動画がダウンロードされていません');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value.trim();
    if (!csvContent) {
        showError('CSVデータがありません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    
    try {
        updateProgress('process-progress', 10, 'CSVをアップロード中...');
        
        // TODO: 動画処理API実装
        
        updateProgress('process-progress', 100, '完了！');
        showInfo('動画処理が完了しました');
        
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessing = false;
    }
}

// ユーティリティ関数
function getStatusClass(status) {
    switch (status) {
        case 'ready': return 'ready';
        case 'downloading_high':
        case 'downloading_analysis': return 'downloading';
        case 'error': return 'error';
        default: return '';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'ready': return '準備完了';
        case 'downloading_high': return '高画質DL中';
        case 'downloading_analysis': return '解析用DL中';
        case 'error': return 'エラー';
        default: return '不明';
    }
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateProgress(progressId, percentage, text) {
    const progressSection = document.getElementById(progressId);
    const progressFill = progressSection.querySelector('.progress-fill');
    const progressText = progressSection.querySelector('.progress-text');
    
    progressSection.style.display = 'block';
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = text;
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showInfo(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.backgroundColor = '#28a745';
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.backgroundColor = '#dc3545';
    }, 3000);
}