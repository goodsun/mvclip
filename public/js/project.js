/**
 * プロジェクト管理モジュール
 * プロジェクトの一覧表示、作成、削除、選択機能を提供
 */

import { 
    formatDuration, 
    escapeHtml, 
    getProjectStatus,
    getHighQualityStatus,
    getAnalysisStatus,
    getStatusText,
    showError, 
    showInfo, 
    updateProgress 
} from './utils.js';

// グローバル変数
export let currentProject = null;
export let projects = [];
export let isProcessing = false;

// isProcessingを更新する関数
export function setIsProcessing(value) {
    isProcessing = value;
}

// currentProjectを更新する関数
export function setCurrentProject(project) {
    currentProject = project;
}

// プロジェクト一覧を読み込み
export async function loadProjects() {
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
export function renderProjectList() {
    const projectList = document.getElementById('project-list');
    
    if (projects.length === 0) {
        projectList.innerHTML = '<div class="no-projects">プロジェクトがありません</div>';
        return;
    }
    
    projectList.innerHTML = projects.map(project => {
        // 新しいステータス関数を使用
        const status = getProjectStatus(project);
        const duration = project.duration ? formatDuration(project.duration) : '-';
        const title = project.title || '-';
        
        return `
            <div class="project-item" data-project-id="${project.videoId}" onclick="selectProject('${project.videoId}')">
                <h4>${escapeHtml(title)}</h4>
                <div class="project-meta">
                    <span>${duration}</span>
                    <span class="separator">•</span>
                    <span class="status-badge ${status.class}">${status.text}</span>
                </div>
            </div>
        `;
    }).join('');
}

// プロジェクトを選択
export async function selectProject(videoId) {
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
            setCurrentProject(data.project);
            showProjectWorkspace();
            updateProjectDisplay();
            
            // 既存のCSVファイルがあれば読み込み
            await loadExistingCSV(data.project.videoId);
        }
    } catch (error) {
        console.error('プロジェクト選択エラー:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// プロジェクトワークスペースを表示
export function showProjectWorkspace() {
    document.getElementById('no-project-selected').style.display = 'none';
    document.getElementById('project-workspace').style.display = 'block';
}

// プロジェクト情報を表示
export function updateProjectDisplay() {
    if (!currentProject) return;
    
    // ヘッダー情報
    document.getElementById('project-title').textContent = currentProject.title;
    document.getElementById('project-duration').textContent = formatDuration(currentProject.duration);
    document.getElementById('project-status').textContent = getStatusText(currentProject.status);
    
    // 詳細情報ページのメタデータを更新
    if (currentProject.videoMetadata) {
        const meta = currentProject.videoMetadata;
        document.getElementById('video-title').textContent = meta.title || currentProject.title || '-';
        document.getElementById('video-url').textContent = currentProject.url || '-';
        document.getElementById('video-duration').textContent = meta.durationText || formatDuration(currentProject.duration);
        document.getElementById('video-resolution').textContent = meta.resolution || '-';
        document.getElementById('video-filesize').textContent = meta.filesizeText || '-';
        document.getElementById('project-created').textContent = currentProject.createdAt ? 
            new Date(currentProject.createdAt).toLocaleString('ja-JP') : '-';
    } else {
        // メタデータがない場合はデフォルト値
        document.getElementById('video-title').textContent = currentProject.title || '-';
        document.getElementById('video-url').textContent = currentProject.url || '-';
        document.getElementById('video-duration').textContent = formatDuration(currentProject.duration);
        document.getElementById('video-resolution').textContent = '-';
        document.getElementById('video-filesize').textContent = '-';
        document.getElementById('project-created').textContent = currentProject.createdAt ? 
            new Date(currentProject.createdAt).toLocaleString('ja-JP') : '-';
    }
    
    // ダウンロード状況を更新
    updateDownloadStatus();
    
    // その他の更新処理は対応するモジュールに移譲
    if (window.updatePreview) window.updatePreview();
    if (window.loadAnalysisRange) window.loadAnalysisRange();
    if (window.loadExistingCSV) window.loadExistingCSV();
    if (window.loadCSVForEdit) window.loadCSVForEdit();
    if (window.updateDetailFinalVideo) window.updateDetailFinalVideo();
}

// ダウンロード状況を更新
function updateDownloadStatus() {
    const highQualityStatus = document.getElementById('high-quality-status');
    const analysisStatus = document.getElementById('analysis-status');
    const highQualityInfo = document.getElementById('high-quality-info');
    const analysisInfo = document.getElementById('analysis-info');
    const redownloadBtn = document.getElementById('redownload-high-btn');
    const recompressBtn = document.getElementById('recompress-analysis-btn');
    
    // クロップ版かどうかを判定
    const isCropProject = currentProject && (currentProject.originalProject || currentProject.cropRange);
    
    // 新しいステータス関数を使用
    const highStatus = getHighQualityStatus(currentProject);
    const analysisStatusData = getAnalysisStatus(currentProject);
    
    // スピナーを追加または取得
    const highQualitySpinner = getOrCreateSpinner('high-quality-spinner');
    const analysisSpinner = getOrCreateSpinner('analysis-spinner');
    
    // ローカルファイルかどうかを確認
    const isLocalFile = currentProject.isLocalFile || currentProject.url?.startsWith('local:');
    
    // 高画質版の状態更新
    highQualityStatus.textContent = highStatus.text;
    highQualityStatus.className = `status-badge ${highStatus.class}`;
    
    switch (highStatus.class) {
        case 'downloaded':
            if (isLocalFile) {
                highQualityInfo.querySelector('p').textContent = '✅ 元動画ファイル（編集用高画質版）';
                redownloadBtn.style.display = 'none';
            } else {
                highQualityInfo.querySelector('p').textContent = '✅ 高画質版がダウンロード済みです';
                redownloadBtn.style.display = 'inline-block';
            }
            
            // クロップ版の場合の注意書きを追加/削除
            updateCropWarning(highQualityInfo, isCropProject);
            
            highQualitySpinner.style.display = 'none';
            break;
        case 'downloading':
            if (isLocalFile) {
                highQualityInfo.querySelector('p').textContent = '📁 動画ファイルを処理中です...';
            } else {
                highQualityInfo.querySelector('p').textContent = '📥 高画質版をダウンロード中です...';
            }
            redownloadBtn.style.display = 'none';
            
            // ダウンロード中は注意書きを非表示
            updateCropWarning(highQualityInfo, false);
            
            highQualitySpinner.style.display = 'inline-block';
            break;
        default:
            if (isLocalFile) {
                highQualityInfo.querySelector('p').textContent = '動画ファイルから編集用高画質版を作成';
                redownloadBtn.style.display = 'none';
            } else {
                highQualityInfo.querySelector('p').textContent = '動画編集で使用する高画質版です';
                redownloadBtn.style.display = 'inline-block';
            }
            
            // クロップ版の場合の注意書きを追加/削除
            updateCropWarning(highQualityInfo, isCropProject);
            
            highQualitySpinner.style.display = 'none';
    }
    
    // 動画結合ボタンの表示制御
    const showConcatBtn = document.getElementById('show-concat-btn');
    if (highStatus.class === 'downloaded') {
        showConcatBtn.style.display = 'inline-block';
    } else {
        showConcatBtn.style.display = 'none';
    }
    
    // 解析用の状態更新
    analysisStatus.textContent = analysisStatusData.text;
    analysisStatus.className = `status-badge ${analysisStatusData.class}`;
    
    switch (analysisStatusData.class) {
        case 'compressed':
            analysisInfo.querySelector('p').textContent = '✅ 解析用動画が圧縮済みです';
            // 高画質版がある場合のみ再圧縮ボタンを表示
            recompressBtn.style.display = highStatus.class === 'downloaded' ? 'inline-block' : 'none';
            
            // クロップ版の場合の注意書きを追加/削除
            if (recompressBtn.style.display === 'inline-block') {
                updateCropWarning(analysisInfo, isCropProject);
            }
            
            analysisSpinner.style.display = 'none';
            break;
        case 'compressing':
            analysisInfo.querySelector('p').textContent = '⚙️ 解析用動画を圧縮中です...';
            recompressBtn.style.display = 'none';
            
            // 圧縮中は注意書きを非表示
            updateCropWarning(analysisInfo, false);
            
            analysisSpinner.style.display = 'inline-block';
            break;
        default:
            analysisInfo.querySelector('p').textContent = '音声認識で字幕を生成する際に使用します';
            // 高画質版がある場合のみ再圧縮ボタンを表示
            recompressBtn.style.display = highStatus.class === 'downloaded' ? 'inline-block' : 'none';
            
            // クロップ版の場合の注意書きを追加/削除
            if (recompressBtn.style.display === 'inline-block') {
                updateCropWarning(analysisInfo, isCropProject);
            }
            
            analysisSpinner.style.display = 'none';
    }
    
    // ローカルファイルの場合の説明を追加
    if (isLocalFile) {
        addLocalFileNotice(highQualityInfo, 'high-quality');
        // 解析用は再圧縮が可能なので説明文は不要
        removeLocalFileNotice(analysisInfo, 'analysis');
    } else {
        removeLocalFileNotice(highQualityInfo, 'high-quality');
        removeLocalFileNotice(analysisInfo, 'analysis');
    }
}

// ローカルファイル用の説明を追加
function addLocalFileNotice(containerElement, type) {
    const noticeId = `local-file-notice-${type}`;
    let noticeElement = document.getElementById(noticeId);
    
    if (!noticeElement) {
        noticeElement = document.createElement('div');
        noticeElement.id = noticeId;
        noticeElement.style.cssText = `
            margin-top: 8px;
            padding: 8px 10px;
            background-color: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 4px;
            font-size: 12px;
            color: #0c5460;
        `;
        
        if (type === 'high-quality') {
            noticeElement.textContent = '📁 ローカルファイルのため再ダウンロードはありません';
        } else {
            noticeElement.textContent = '📁 ローカルファイルのため再圧縮はありません';
        }
        
        containerElement.appendChild(noticeElement);
    }
}

// ローカルファイル用の説明を削除
function removeLocalFileNotice(containerElement, type) {
    const noticeId = `local-file-notice-${type}`;
    const noticeElement = document.getElementById(noticeId);
    if (noticeElement) {
        noticeElement.remove();
    }
}

// クロップ版の場合の注意書きを更新
function updateCropWarning(containerElement, isCropProject) {
    const warningId = 'crop-warning-' + containerElement.id;
    let warningElement = document.getElementById(warningId);
    
    if (isCropProject) {
        // 注意書きを追加（まだない場合）
        if (!warningElement) {
            warningElement = document.createElement('div');
            warningElement.id = warningId;
            warningElement.style.cssText = `
                margin-top: 5px;
                padding: 5px 8px;
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 4px;
                font-size: 12px;
                color: #856404;
            `;
            warningElement.textContent = '⚠️ 元動画がダウンロードされます';
            containerElement.appendChild(warningElement);
        }
    } else {
        // クロップ版でない場合は注意書きを削除
        if (warningElement) {
            warningElement.remove();
        }
    }
}

// スピナー要素を取得または作成
function getOrCreateSpinner(spinnerId) {
    let spinner = document.getElementById(spinnerId);
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = spinnerId;
        spinner.className = 'spinner';
        spinner.style.cssText = `
            display: none;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-top: 10px;
            margin-left: 10px;
        `;
        
        // スピナーをボタンの親要素に追加
        if (spinnerId === 'high-quality-spinner') {
            document.getElementById('high-quality-info').appendChild(spinner);
        } else if (spinnerId === 'analysis-spinner') {
            document.getElementById('analysis-info').appendChild(spinner);
        }
        
        // CSSアニメーションを追加（まだ存在しない場合）
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    return spinner;
}

// 新規プロジェクト作成
export async function createNewProject() {
    // 現在アクティブなソースタブを確認
    const activeTab = document.querySelector('.source-tab.active');
    const sourceType = activeTab ? activeTab.dataset.source : 'youtube';
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    let requestBody;
    let endpoint = '/api/projects/create';
    
    if (sourceType === 'youtube') {
        const url = document.getElementById('new-project-url').value.trim();
        if (!url) {
            showError('YouTube URLを入力してください');
            return;
        }
        requestBody = { url };
    } else if (sourceType === 'local') {
        const fileInput = document.getElementById('new-project-file');
        const file = fileInput.files[0];
        if (!file) {
            showError('動画ファイルを選択してください');
            return;
        }
        
        const projectName = document.getElementById('new-project-name').value.trim() || 
                           file.name.replace(/\.[^/.]+$/, '');
        
        // ローカルファイル用の処理
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', projectName);
        
        endpoint = '/api/projects/create/local';
        requestBody = formData;
    }
    
    setIsProcessing(true);
    let eventSource = null;
    
    try {
        // プロジェクト作成開始のログエリアを表示
        showProjectCreationProgress();
        
        const requestOptions = {
            method: 'POST'
        };
        
        if (sourceType === 'youtube') {
            requestOptions.headers = { 'Content-Type': 'application/json' };
            requestOptions.body = JSON.stringify(requestBody);
        } else {
            requestOptions.body = requestBody; // FormData
        }
        
        const response = await fetch(endpoint, requestOptions);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'プロジェクト作成に失敗しました');
        }
        
        const result = await response.json();
        const sessionId = result.sessionId;
        
        // SSEで進捗を監視
        eventSource = new EventSource(`/api/projects/create/progress/${sessionId}`);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            updateProjectCreationProgress(data);
            
            if (data.type === 'progress') {
                updateProgress('download-progress', data.progress, data.message);
            }
            
            // ダウンロード完了やファイル処理完了時にプロジェクト一覧を更新
            if (data.type === 'download_complete' || data.type === 'compression_complete' || data.type === 'upload_complete') {
                // リアルタイムでプロジェクト一覧を更新
                loadProjects();
                
                // 現在のプロジェクトが新規作成中のプロジェクトの場合、ダウンロード状態も更新
                if (currentProject && data.projectId && currentProject.videoId === data.projectId) {
                    updateDownloadStatus();
                }
            }
            
            // 完了またはエラー時
            if (data.stage === 'completed') {
                eventSource.close();
                setTimeout(async () => {
                    // モーダルを閉じてプロジェクト一覧を更新
                    closeNewProjectModal();
                    await loadProjects();
                    hideProjectCreationProgress();
                    showInfo('プロジェクトが作成されました');
                    setIsProcessing(false);
                }, 1000);
            } else if (data.stage === 'error') {
                eventSource.close();
                throw new Error(data.message);
            }
        };
        
        eventSource.onerror = () => {
            console.error('SSE接続エラー');
            eventSource.close();
        };
        
    } catch (error) {
        showError(error.message);
        hideProjectCreationProgress();
        setIsProcessing(false);
        if (eventSource) {
            eventSource.close();
        }
    }
}

// 現在のプロジェクトを削除
export async function deleteCurrentProject() {
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
        
        setCurrentProject(null);
        showInfo('プロジェクトが削除されました');
        
    } catch (error) {
        showError(error.message);
    }
}

// プロジェクト作成進捗表示
function showProjectCreationProgress() {
    const progressDiv = document.getElementById('download-progress');
    if (progressDiv) {
        progressDiv.style.display = 'block';
    }
    
    // ログエリアを作成
    let logArea = document.getElementById('creation-log-area');
    if (!logArea) {
        logArea = document.createElement('div');
        logArea.id = 'creation-log-area';
        logArea.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 2000;
            width: 500px;
            max-width: 90vw;
            max-height: 400px;
            overflow-y: auto;
        `;
        logArea.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0;">🚀 プロジェクト作成中</h3>
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <div class="progress-bar" style="width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
                <div class="progress-fill" style="height: 100%; background: #3498db; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="creation-log" style="font-family: monospace; font-size: 12px; background: #f8f9fa; border-radius: 4px; padding: 10px; height: 200px; overflow-y: auto; white-space: pre-wrap;"></div>
        `;
        
        // CSSアニメーションを追加
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(logArea);
    }
    
    logArea.style.display = 'block';
    
    // 初期メッセージ
    const logDiv = document.getElementById('creation-log');
    if (logDiv) {
        logDiv.textContent = '🚀 プロジェクト作成を開始しています...\n';
    }
}

// プロジェクト作成進捗更新
function updateProjectCreationProgress(data) {
    const logDiv = document.getElementById('creation-log');
    const progressFill = document.querySelector('#creation-log-area .progress-fill');
    
    if (logDiv) {
        const timestamp = new Date().toLocaleTimeString();
        const message = `[${timestamp}] ${data.message || data.type}\n`;
        logDiv.textContent += message;
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    if (progressFill && data.progress) {
        progressFill.style.width = `${data.progress}%`;
    }
}

// プロジェクト作成進捗非表示
function hideProjectCreationProgress() {
    const logArea = document.getElementById('creation-log-area');
    if (logArea) {
        setTimeout(() => {
            logArea.style.display = 'none';
        }, 2000);
    }
    
    const progressDiv = document.getElementById('download-progress');
    if (progressDiv) {
        setTimeout(() => {
            progressDiv.style.display = 'none';
        }, 2000);
    }
}

// 高画質版を再ダウンロード
export async function redownloadHighQuality(event) {
    if (event) event.preventDefault();
    
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    setIsProcessing(true);
    const button = event.target;
    const originalText = button.textContent;
    
    try {
        button.textContent = '⏳ 再ダウンロード中...';
        button.disabled = true;
        
        const response = await fetch(`/api/projects/${currentProject.videoId}/redownload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '再ダウンロードに失敗しました');
        }
        
        showInfo('高画質版の再ダウンロードが完了しました');
        
        // プロジェクト情報を再取得して UI を更新
        const response2 = await fetch(`/api/projects/${currentProject.videoId}`);
        const data2 = await response2.json();
        
        if (data2.success) {
            // プロジェクト情報を更新
            setCurrentProject(data2.project);
            
            // 左ペインのプロジェクト一覧を更新
            await loadProjects();
            
            // ダウンロード状態セクションを即座に更新
            updateDownloadStatus();
            
            // アクティブなプロジェクトをマーク
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeItem = document.querySelector(`[data-project-id="${currentProject.videoId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
        
    } catch (error) {
        console.error('再ダウンロードエラー:', error);
        showError(error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        setIsProcessing(false);
    }
}

// 解析用動画を再圧縮
export async function recompressAnalysisVideo(event) {
    if (event) event.preventDefault();
    
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (!currentProject.files?.highQuality) {
        showError('高画質版動画がありません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    setIsProcessing(true);
    const button = event.target;
    const originalText = button.textContent;
    
    try {
        button.textContent = '⏳ 再圧縮中...';
        button.disabled = true;
        
        const response = await fetch(`/api/projects/${currentProject.videoId}/recompress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '再圧縮に失敗しました');
        }
        
        showInfo('解析用動画の再圧縮が完了しました');
        
        // プロジェクト情報を再取得して UI を更新
        const response2 = await fetch(`/api/projects/${currentProject.videoId}`);
        const data2 = await response2.json();
        
        if (data2.success) {
            // プロジェクト情報を更新
            setCurrentProject(data2.project);
            
            // 左ペインのプロジェクト一覧を更新
            await loadProjects();
            
            // ダウンロード状態セクションを即座に更新
            updateDownloadStatus();
            
            // アクティブなプロジェクトをマーク
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeItem = document.querySelector(`[data-project-id="${currentProject.videoId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
        
    } catch (error) {
        console.error('再圧縮エラー:', error);
        showError(error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        setIsProcessing(false);
    }
}

// プロジェクト管理のイベントリスナーをセットアップ
export function setupProjectEventListeners() {
    // 新規プロジェクト作成モーダル
    document.getElementById('new-project-btn').addEventListener('click', () => {
        document.getElementById('new-project-modal').style.display = 'flex';
        // YouTubeタブをデフォルトで選択
        switchSourceTab('youtube');
    });
    
    // ソース選択タブ
    document.querySelectorAll('.source-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const source = e.target.dataset.source;
            switchSourceTab(source);
        });
    });
    
    // ローカルファイル選択時に名前を自動入力
    document.getElementById('new-project-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const nameInput = document.getElementById('new-project-name');
            if (!nameInput.value) {
                // 拡張子を除いたファイル名を設定
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                nameInput.value = nameWithoutExt;
            }
        }
    });
    
    // モーダルクローズ
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            closeNewProjectModal();
        });
    });
    
    // モーダル外クリック
    document.getElementById('new-project-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeNewProjectModal();
        }
    });
    
    // プロジェクト作成確定
    document.getElementById('confirm-create-project').addEventListener('click', createNewProject);
    
    // プロジェクト削除
    document.getElementById('delete-project-btn').addEventListener('click', deleteCurrentProject);
    
    // 再ダウンロード・再圧縮ボタン
    document.getElementById('redownload-high-btn').addEventListener('click', redownloadHighQuality);
    document.getElementById('recompress-analysis-btn').addEventListener('click', recompressAnalysisVideo);
    
    // 動画結合機能
    document.getElementById('show-concat-btn').addEventListener('click', showConcatSection);
    document.getElementById('cancel-concat-btn').addEventListener('click', hideConcatSection);
    document.getElementById('concat-video-btn').addEventListener('click', concatVideo);
    
    // ファイル種類切り替え
    document.querySelectorAll('input[name="concat-file-type"]').forEach(radio => {
        radio.addEventListener('change', switchConcatFileType);
    });
}

// ソースタブを切り替え
function switchSourceTab(source) {
    // タブボタンの状態更新
    document.querySelectorAll('.source-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-source="${source}"]`).classList.add('active');
    
    // コンテンツの表示切り替え
    document.querySelectorAll('.source-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`${source}-source`);
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
}

// モーダルを閉じてフォームをリセット
function closeNewProjectModal() {
    document.getElementById('new-project-modal').style.display = 'none';
    // フォームをリセット
    document.getElementById('new-project-url').value = '';
    document.getElementById('new-project-file').value = '';
    document.getElementById('new-project-name').value = '';
    // YouTubeタブに戻す
    switchSourceTab('youtube');
}

// 既存のCSVファイルを読み込み
async function loadExistingCSV(videoId) {
    try {
        const response = await fetch(`/projects/${videoId}/subtitles.csv`);
        if (response.ok) {
            const csvContent = await response.text();
            if (csvContent.trim()) {
                // CSVを表示
                document.getElementById('csv-result').style.display = 'block';
                document.getElementById('csv-content').value = csvContent;
                document.getElementById('csv-editor-content').value = csvContent;
                
                // ボタンの表示状態を更新
                document.getElementById('start-analysis-btn').style.display = 'none';
                document.getElementById('reanalyze-btn').style.display = 'inline-block';
                
                // フォントプレビューを更新
                setTimeout(() => {
                    if (window.updateFontPreview) {
                        window.updateFontPreview();
                    }
                }, 100);
                
                console.log('✅ 既存のCSVファイルを読み込みました');
                return; // CSVが存在する場合は終了
            }
        }
    } catch (error) {
        console.log('📝 CSVファイルはまだ存在しません');
    }
    
    // CSVが存在しない場合、フォームをリセット
    resetSubtitleForms();
}

// 字幕関連フォームをリセット
function resetSubtitleForms() {
    // 字幕解析タブのリセット
    document.getElementById('csv-result').style.display = 'none';
    document.getElementById('csv-content').value = '';
    document.getElementById('start-analysis-btn').style.display = 'inline-block';
    document.getElementById('reanalyze-btn').style.display = 'none';
    
    // 動画編集タブのリセット
    document.getElementById('csv-editor-content').value = '';
    document.getElementById('video-result').style.display = 'none';
    
    // 字幕プレビューをリセット
    const previewList = document.getElementById('subtitle-preview-list');
    if (previewList) {
        previewList.innerHTML = '<p class="preview-placeholder">CSVデータを読み込むと、ここに字幕が表示されます</p>';
    }
    
    console.log('🔄 字幕関連フォームをリセットしました');
}

// 動画結合セクションを表示
function showConcatSection() {
    document.getElementById('video-concat-section').style.display = 'block';
    document.getElementById('show-concat-btn').style.display = 'none';
}

// 動画結合セクションを非表示
function hideConcatSection() {
    document.getElementById('video-concat-section').style.display = 'none';
    document.getElementById('show-concat-btn').style.display = 'inline-block';
    // フォームをリセット
    document.getElementById('concat-video-file').value = '';
    document.querySelector('input[name="concat-position"][value="append"]').checked = true;
    document.querySelector('input[name="concat-file-type"][value="video"]').checked = true;
    switchConcatFileType(); // UI を動画モードに戻す
}

// ファイル種類切り替え
function switchConcatFileType() {
    const fileType = document.querySelector('input[name="concat-file-type"]:checked').value;
    const fileInput = document.getElementById('concat-video-file');
    const fileLabel = document.getElementById('concat-file-label');
    const durationSection = document.getElementById('image-duration-section');
    
    if (fileType === 'image') {
        fileInput.accept = 'image/*';
        fileLabel.textContent = '静止画ファイル:';
        durationSection.style.display = 'block';
    } else {
        fileInput.accept = 'video/*';
        fileLabel.textContent = '動画ファイル:';
        durationSection.style.display = 'none';
    }
    
    // ファイル選択をクリア
    fileInput.value = '';
}

// 動画結合を実行
async function concatVideo() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    const fileInput = document.getElementById('concat-video-file');
    const file = fileInput.files[0];
    const fileType = document.querySelector('input[name="concat-file-type"]:checked').value;
    
    if (!file) {
        showError(`結合する${fileType === 'image' ? '静止画' : '動画'}ファイルを選択してください`);
        return;
    }
    
    const position = document.querySelector('input[name="concat-position"]:checked').value;
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    const contentType = fileType === 'image' ? '静止画' : '動画';
    const confirmMessage = position === 'prepend' 
        ? `選択した${contentType}を現在の動画の前に結合しますか？\n結合後は元の動画に戻すことはできません。`
        : `選択した${contentType}を現在の動画の後ろに結合しますか？\n結合後は元の動画に戻すことはできません。`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    setIsProcessing(true);
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('position', position);
        formData.append('fileType', fileType);
        
        // 静止画の場合は表示時間も送信
        if (fileType === 'image') {
            const duration = document.getElementById('image-duration').value;
            formData.append('duration', duration);
        }
        
        const button = document.getElementById('concat-video-btn');
        const originalText = button.textContent;
        button.textContent = '📎 結合中...';
        button.disabled = true;
        
        const response = await fetch(`/api/projects/${currentProject.videoId}/concat`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '動画結合に失敗しました');
        }
        
        const result = await response.json();
        
        showInfo(`${contentType}が${position === 'prepend' ? '前に' : '後ろに'}結合されました`);
        
        // プロジェクト情報を再取得して UI を更新
        const response2 = await fetch(`/api/projects/${currentProject.videoId}`);
        const data2 = await response2.json();
        
        if (data2.success) {
            setCurrentProject(data2.project);
            await loadProjects();
            updateProjectDisplay();
            updateDownloadStatus();
            
            // アクティブなプロジェクトをマーク
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeItem = document.querySelector(`[data-project-id="${currentProject.videoId}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }
        }
        
        // フォームを非表示
        hideConcatSection();
        
    } catch (error) {
        console.error('結合エラー:', error);
        showError(error.message);
    } finally {
        const button = document.getElementById('concat-video-btn');
        button.textContent = '📎 結合';
        button.disabled = false;
        setIsProcessing(false);
    }
}

// グローバル関数として公開
window.selectProject = selectProject;