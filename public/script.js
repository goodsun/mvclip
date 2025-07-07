// グローバル変数
let currentProject = null;
let projects = [];
let isProcessing = false;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    await loadSystemFonts();
    setupEventListeners();
    setupKeyboardShortcuts();
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

// システムフォント一覧を読み込み
async function loadSystemFonts() {
    try {
        console.log('📝 システムフォント一覧を読み込み中...');
        const response = await fetch('/api/fonts');
        const data = await response.json();
        
        if (data.success) {
            const fontSelect = document.getElementById('subtitle-font');
            if (fontSelect) {
                // 既存のオプションをクリア
                fontSelect.innerHTML = '';
                
                // システムフォントを追加
                data.fonts.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font.name;
                    option.textContent = font.displayName;
                    fontSelect.appendChild(option);
                });
                
                // デフォルトでArialを選択
                fontSelect.value = 'Arial';
                
                console.log(`✅ ${data.fonts.length}個のシステムフォントを読み込み完了`);
                
                if (data.fallback) {
                    console.warn('⚠️ フォールバックフォントを使用中');
                }
            }
        }
    } catch (error) {
        console.error('❌ システムフォント読み込みエラー:', error);
        
        // エラー時はデフォルトフォントを設定
        const fontSelect = document.getElementById('subtitle-font');
        if (fontSelect) {
            fontSelect.innerHTML = `
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Impact">Impact</option>
            `;
        }
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
    
    // 保存された解析範囲を復元
    loadAnalysisRange();
    
    // 既存のCSVがあれば表示
    loadExistingCSV();
    
    // 動画編集タブのCSVも更新
    loadCSVForEdit();
}

// ダウンロード状況を更新
function updateDownloadStatus() {
    const highQualityStatus = document.getElementById('high-quality-status');
    const analysisStatus = document.getElementById('analysis-status');
    const highQualityInfo = document.getElementById('high-quality-info');
    const analysisInfo = document.getElementById('analysis-info');
    const redownloadBtn = document.getElementById('redownload-high-btn');
    const recompressBtn = document.getElementById('recompress-analysis-btn');
    
    const hasHighQuality = currentProject.files?.highQuality;
    const hasAnalysis = currentProject.files?.analysis;
    const status = currentProject.status;
    
    // 高画質版
    if (hasHighQuality) {
        highQualityStatus.textContent = '✅ ダウンロード済み';
        highQualityStatus.className = 'status-badge ready';
        highQualityInfo.querySelector('p').textContent = '✅ 高画質版がダウンロード済みです';
        redownloadBtn.style.display = 'none';
    } else if (status === 'error' || (status === 'ready' && !hasHighQuality)) {
        highQualityStatus.textContent = 'ダウンロード失敗';
        highQualityStatus.className = 'status-badge error';
        highQualityInfo.querySelector('p').textContent = 'ダウンロードに失敗しました';
        redownloadBtn.style.display = 'inline-block';
    } else {
        highQualityStatus.textContent = '未ダウンロード';
        highQualityStatus.className = 'status-badge';
        highQualityInfo.querySelector('p').textContent = '動画編集で使用する高画質版です';
        redownloadBtn.style.display = 'none';
    }
    
    // 解析用
    if (hasAnalysis) {
        analysisStatus.textContent = '✅ 圧縮済み';
        analysisStatus.className = 'status-badge ready';
        analysisInfo.querySelector('p').textContent = '✅ 解析用動画が圧縮済みです';
        recompressBtn.style.display = hasHighQuality ? 'inline-block' : 'none';
    } else if (hasHighQuality) {
        analysisStatus.textContent = '圧縮失敗';
        analysisStatus.className = 'status-badge error';
        analysisInfo.querySelector('p').textContent = '圧縮処理に失敗しました';
        recompressBtn.style.display = 'inline-block';
    } else {
        analysisStatus.textContent = '未作成';
        analysisStatus.className = 'status-badge';
        analysisInfo.querySelector('p').textContent = '音声認識で字幕を生成する際に使用します';
        recompressBtn.style.display = 'none';
    }
}

// プレビューを更新
function updatePreview() {
    const previewVideo = document.getElementById('preview-video');
    const previewSelect = document.getElementById('preview-select');
    const videoDetails = document.getElementById('video-details');
    
    // イベントリスナーの重複を避けるためにクローンして置き換え
    const newPreviewSelect = previewSelect.cloneNode(true);
    previewSelect.parentNode.replaceChild(newPreviewSelect, previewSelect);
    
    // プレビューセレクターの変更イベント
    newPreviewSelect.addEventListener('change', () => {
        const selectedType = newPreviewSelect.value;
        const videoPath = selectedType === 'high' ? currentProject.files.highQuality : currentProject.files.analysis;
        
        if (videoPath) {
            // プロジェクトファイル配信APIを使用
            previewVideo.src = `/projects/${currentProject.videoId}/${selectedType === 'high' ? 'video_high.mp4' : 'video_analysis.mp4'}`;
            previewVideo.style.display = 'block';
            
            // デフォルトでは通常再生（範囲制限なし）
            clearVideoRange(previewVideo);
            
            // 動画詳細を表示
            updateVideoDetails();
            
            // 動画イベントリスナーを設定
            setupVideoEventListeners(previewVideo);
        } else {
            previewVideo.style.display = 'none';
            videoDetails.innerHTML = '<p>選択された動画がダウンロードされていません</p>';
        }
    });
    
    // 初期表示
    newPreviewSelect.dispatchEvent(new Event('change'));
}

// 動画イベントリスナーを設定
function setupVideoEventListeners(videoElement) {
    // 既存のリスナーを削除
    if (videoElement._pauseHandler) {
        videoElement.removeEventListener('pause', videoElement._pauseHandler);
        videoElement.removeEventListener('ended', videoElement._pauseHandler);
    }
    
    // 一時停止・終了時のハンドラー
    const pauseHandler = () => {
        // 範囲モード中でない場合はボタン状態をリセット
        if (!videoElement._rangeCheckHandler) {
            updatePlayModeButtons('none');
        }
    };
    
    videoElement._pauseHandler = pauseHandler;
    videoElement.addEventListener('pause', pauseHandler);
    videoElement.addEventListener('ended', pauseHandler);
}

// 再生モードボタンの状態を更新
function updatePlayModeButtons(mode) {
    const rangeBtn = document.getElementById('play-range-btn');
    const fullBtn = document.getElementById('play-full-btn');
    
    // すべてのアクティブクラスを削除
    rangeBtn.classList.remove('active-range', 'active-full');
    fullBtn.classList.remove('active-range', 'active-full');
    
    // モードに応じてアクティブクラスを追加
    if (mode === 'range') {
        rangeBtn.classList.add('active-range');
    } else if (mode === 'full') {
        fullBtn.classList.add('active-full');
    }
}

// 動画詳細表示を更新
function updateVideoDetails() {
    const videoDetails = document.getElementById('video-details');
    const rangeDisplay = document.getElementById('range-display');
    const previewSelect = document.getElementById('preview-select');
    
    if (!currentProject || !previewSelect) {
        return;
    }
    
    const selectedType = previewSelect.value;
    const videoPath = selectedType === 'high' ? currentProject.files.highQuality : currentProject.files.analysis;
    
    // 範囲表示を更新
    const rangeText = currentProject.analysisRange ? 
        `再生範囲: ${currentProject.analysisRange.start || '0:00'} 〜 ${currentProject.analysisRange.end || '終了まで'}` : 
        '再生範囲: 全体';
    
    if (rangeDisplay) {
        rangeDisplay.textContent = rangeText;
    }
    
    if (videoPath) {
        videoDetails.innerHTML = `
            <h4>${selectedType === 'high' ? '🎬 高画質版' : '📝 解析用'}</h4>
            <p>ファイル: ${selectedType === 'high' ? 'video_high.mp4' : 'video_analysis.mp4'}</p>
            <p>用途: ${selectedType === 'high' ? '動画編集' : '字幕解析'}</p>
        `;
    } else {
        videoDetails.innerHTML = '<p>選択された動画がダウンロードされていません</p>';
    }
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
    
    // 再解析
    document.getElementById('reanalyze-btn').addEventListener('click', reAnalyze);
    
    // 解析範囲保存
    document.getElementById('save-analysis-range-btn').addEventListener('click', saveAnalysisRange);
    
    // CSV保存
    document.getElementById('save-csv').addEventListener('click', saveCSVToProject);
    
    // CSVダウンロード
    document.getElementById('download-csv').addEventListener('click', downloadCSV);
    
    // 動画編集
    document.getElementById('preview-video-btn').addEventListener('click', generatePreviewVideo);
    document.getElementById('final-video-btn').addEventListener('click', generateFinalVideo);
    
    // プレビューコントロール
    document.getElementById('play-range-btn').addEventListener('click', playVideoRange);
    document.getElementById('play-full-btn').addEventListener('click', playFullVideo);
    document.getElementById('set-start-btn').addEventListener('click', setStartPosition);
    document.getElementById('set-end-btn').addEventListener('click', setEndPosition);
    
    // スキップコントロール
    document.getElementById('back-5s-btn').addEventListener('click', () => skipVideo(-5));
    document.getElementById('forward-5s-btn').addEventListener('click', () => skipVideo(5));
    document.getElementById('back-10s-btn').addEventListener('click', () => skipVideo(-10));
    document.getElementById('forward-10s-btn').addEventListener('click', () => skipVideo(10));
    
    // 動画ダウンロード
    document.getElementById('download-processed-video').addEventListener('click', downloadFinalVideo);
    
    // CSVファイルアップロード（要素が存在する場合のみ）
    const csvUploadFile = document.getElementById('csv-upload-file');
    if (csvUploadFile) {
        csvUploadFile.addEventListener('change', handleCSVUpload);
    }
    
    // 再ダウンロード・再圧縮ボタン
    document.getElementById('redownload-high-btn').addEventListener('click', redownloadHighQuality);
    document.getElementById('recompress-analysis-btn').addEventListener('click', recompressAnalysisVideo);
    
    // フォント選択時のプレビュー更新（要素が存在する場合のみ）
    const subtitleFont = document.getElementById('subtitle-font');
    if (subtitleFont) {
        subtitleFont.addEventListener('change', updateFontPreview);
        // 初期プレビュー設定
        updateFontPreview();
    }
    
    // CSVエディタの内容が変更されたときにプレビューを更新
    const csvEditor = document.getElementById('csv-editor-content');
    if (csvEditor) {
        csvEditor.addEventListener('input', updateFontPreview);
    }
}

// CSVファイルアップロード処理
function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('csv-editor-content').value = e.target.result;
            document.querySelector('.csv-editor').style.display = 'block';
            showInfo(`CSVファイル「${file.name}」を読み込みました`);
        };
        reader.readAsText(file);
    }
}

// 新規プロジェクト作成
async function createNewProject() {
    const url = document.getElementById('new-project-url').value.trim();
    
    if (!url) {
        showError('YouTube URLを入力してください');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    let eventSource = null;
    
    try {
        // プロジェクト作成開始のログエリアを表示
        showProjectCreationProgress();
        
        const requestBody = { url };
        
        const response = await fetch('/api/projects/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
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
            
            // 完了またはエラー時
            if (data.stage === 'completed') {
                eventSource.close();
                setTimeout(async () => {
                    // モーダルを閉じてプロジェクト一覧を更新
                    document.getElementById('new-project-modal').style.display = 'none';
                    await loadProjects();
                    hideProjectCreationProgress();
                    showInfo('プロジェクトが作成されました');
                    isProcessing = false;
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
        isProcessing = false;
        if (eventSource) {
            eventSource.close();
        }
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
async function startAnalysis(event) {
    if (event) event.preventDefault();
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
        
        // 解析範囲を取得
        const startTime = document.getElementById('analyze-start-time').value.trim();
        const endTime = document.getElementById('analyze-end-time').value.trim();
        
        const requestBody = {
            videoPath: currentProject.files.analysis,
            videoId: currentProject.videoId
        };
        
        // 時間範囲が指定されている場合は追加
        if (startTime || endTime) {
            requestBody.timeRange = {};
            if (startTime) requestBody.timeRange.start = startTime;
            if (endTime) requestBody.timeRange.end = endTime;
        }
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
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
        
        // ボタン表示を更新
        document.getElementById('start-analysis-btn').style.display = 'none';
        document.getElementById('reanalyze-btn').style.display = 'inline-block';
        
        // 動画編集タブのCSVも更新
        document.getElementById('csv-editor-content').value = data.csvContent;
        
        // プレビューを更新
        updateFontPreview();
        
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
async function saveCSVToProject(event) {
    if (event) event.preventDefault();
    const csvContent = document.getElementById('csv-content').value;
    
    if (!csvContent || !currentProject) {
        showError('保存するCSVデータがありません');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}/csv`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csvContent })
        });
        
        if (!response.ok) {
            throw new Error('CSV保存に失敗しました');
        }
        
        showInfo('CSVがプロジェクトに保存されました');
        
        // プロジェクト情報を更新
        await selectProject(currentProject.videoId);
        
        // 動画編集タブのCSVも更新
        loadCSVForEdit();
        
    } catch (error) {
        showError(error.message);
    }
}

// CSVをダウンロード
function downloadCSV(event) {
    if (event) event.preventDefault();
    const csvContent = document.getElementById('csv-content').value;
    
    if (!csvContent) {
        showError('ダウンロードするCSVデータがありません');
        return;
    }
    
    // クライアントサイドでダウンロード
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = currentProject ? `${currentProject.videoId}_subtitles.csv` : 'subtitles.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showInfo('CSVファイルをダウンロードしました');
}

// 解析範囲を保存
async function saveAnalysisRange(event) {
    if (event) event.preventDefault();
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    const startTime = document.getElementById('analyze-start-time').value.trim();
    const endTime = document.getElementById('analyze-end-time').value.trim();
    
    const analysisRange = {};
    if (startTime) analysisRange.start = startTime;
    if (endTime) analysisRange.end = endTime;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}/analysis-range`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysisRange: Object.keys(analysisRange).length > 0 ? analysisRange : null })
        });
        
        if (!response.ok) {
            throw new Error('解析範囲の保存に失敗しました');
        }
        
        // プロジェクト情報を更新
        currentProject.analysisRange = Object.keys(analysisRange).length > 0 ? analysisRange : null;
        
        showInfo('解析範囲が保存されました');
        
    } catch (error) {
        showError(error.message);
    }
}

// 動画の範囲制限をクリア（通常再生）
function clearVideoRange(videoElement) {
    // 既存のイベントリスナーを削除
    if (videoElement._rangeCheckHandler) {
        videoElement.removeEventListener('timeupdate', videoElement._rangeCheckHandler);
        delete videoElement._rangeCheckHandler;
    }
}

// 範囲再生モードを有効にする（開始位置に移動）
function enableRangeMode(videoElement) {
    if (!currentProject || !currentProject.analysisRange) {
        return;
    }
    
    const startTime = parseTimeToSeconds(currentProject.analysisRange.start || '0:00');
    const endTime = currentProject.analysisRange.end ? parseTimeToSeconds(currentProject.analysisRange.end) : null;
    
    // 既存のハンドラーをクリア
    clearVideoRange(videoElement);
    
    // 範囲チェック用ハンドラー
    const rangeCheckHandler = () => {
        if (endTime && videoElement.currentTime >= endTime) {
            videoElement.pause();
            videoElement.currentTime = startTime;
        }
    };
    
    // ハンドラーを保存して設定
    videoElement._rangeCheckHandler = rangeCheckHandler;
    videoElement.addEventListener('timeupdate', rangeCheckHandler);
    
    // 開始位置に移動
    videoElement.currentTime = startTime;
}

// 範囲チェックのみ有効にする（位置移動なし）
function enableRangeCheck(videoElement) {
    if (!currentProject || !currentProject.analysisRange) {
        return;
    }
    
    const startTime = parseTimeToSeconds(currentProject.analysisRange.start || '0:00');
    const endTime = currentProject.analysisRange.end ? parseTimeToSeconds(currentProject.analysisRange.end) : null;
    
    // 既存のハンドラーをクリア
    clearVideoRange(videoElement);
    
    // 範囲チェック用ハンドラー（位置移動なし）
    const rangeCheckHandler = () => {
        if (endTime && videoElement.currentTime >= endTime) {
            videoElement.pause();
            videoElement.currentTime = startTime;
        }
    };
    
    // ハンドラーを保存して設定
    videoElement._rangeCheckHandler = rangeCheckHandler;
    videoElement.addEventListener('timeupdate', rangeCheckHandler);
}

// 時間文字列を秒数に変換
function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    
    const parts = timeStr.split(':');
    let seconds = 0;
    
    if (parts.length === 1) {
        // 秒のみ（例: "30.500"）
        seconds = parseFloat(parts[0]);
    } else if (parts.length === 2) {
        // 分:秒（例: "1:30.500"）
        seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
    } else if (parts.length === 3) {
        // 時:分:秒（例: "1:05:30.500"）
        seconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    }
    
    return seconds;
}

// 秒数を時間文字列に変換
function secondsToTimeString(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
}

// 解析範囲を読み込み
function loadAnalysisRange() {
    if (!currentProject) return;
    
    const startTimeInput = document.getElementById('analyze-start-time');
    const endTimeInput = document.getElementById('analyze-end-time');
    
    if (currentProject.analysisRange) {
        startTimeInput.value = currentProject.analysisRange.start || '';
        endTimeInput.value = currentProject.analysisRange.end || '';
    } else {
        startTimeInput.value = '';
        endTimeInput.value = '';
    }
}

// 既存のCSVを読み込み表示
async function loadExistingCSV() {
    if (!currentProject || !currentProject.files.subtitles) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}/csv`);
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('csv-content').value = data.csvContent;
            document.getElementById('csv-result').style.display = 'block';
            
            // ボタン表示を更新
            document.getElementById('start-analysis-btn').style.display = 'none';
            document.getElementById('reanalyze-btn').style.display = 'inline-block';
            
            // 解析完了状態を示すメッセージも表示
            const progressSection = document.getElementById('analysis-progress');
            const progressText = progressSection.querySelector('.progress-text');
            const progressFill = progressSection.querySelector('.progress-fill');
            
            progressSection.style.display = 'block';
            progressFill.style.width = '100%';
            progressText.textContent = '既存のCSVを表示中';
            
            setTimeout(() => {
                progressSection.style.display = 'none';
            }, 2000);
            
            console.log('既存のCSVを表示しました');
        }
    } catch (error) {
        console.log('既存CSVの読み込みに失敗:', error.message);
        // エラーは表示しない（CSVがない場合は正常）
    }
}

// 再解析を実行
async function reAnalyze(event) {
    if (event) event.preventDefault();
    // ボタン表示を元に戻す
    document.getElementById('start-analysis-btn').style.display = 'inline-block';
    document.getElementById('reanalyze-btn').style.display = 'none';
    
    // CSVセクションを非表示
    document.getElementById('csv-result').style.display = 'none';
    
    // 解析を実行
    await startAnalysis();
}

// 範囲リピート再生
function playVideoRange(event) {
    event.preventDefault();
    const previewVideo = document.getElementById('preview-video');
    
    if (!currentProject || !currentProject.analysisRange) {
        showError('解析範囲が設定されていません。字幕解析タブで範囲を設定してください。');
        return;
    }
    
    // 範囲再生モードを有効にして再生開始
    enableRangeMode(previewVideo);
    previewVideo.play();
    
    // ボタンの状態を更新
    updatePlayModeButtons('range');
    
    showInfo('範囲リピート再生を開始しました');
}

// 全体再生
function playFullVideo(event) {
    event.preventDefault();
    const previewVideo = document.getElementById('preview-video');
    
    // 範囲制限をクリアして通常再生モードにする
    clearVideoRange(previewVideo);
    previewVideo.play();
    
    // ボタンの状態を更新
    updatePlayModeButtons('full');
    
    showInfo('全体再生を開始しました');
}

// 現在位置を開始位置に設定
async function setStartPosition(event) {
    event.preventDefault();
    const previewVideo = document.getElementById('preview-video');
    
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (previewVideo.readyState < 1) {
        showError('動画が読み込まれていません');
        return;
    }
    
    const currentTime = previewVideo.currentTime;
    const timeString = secondsToTimeString(currentTime);
    
    // 既存の終了位置をチェック
    const existingEnd = currentProject.analysisRange?.end;
    if (existingEnd) {
        const endTime = parseTimeToSeconds(existingEnd);
        if (currentTime >= endTime) {
            showError(`開始位置（${timeString}）は終了位置（${existingEnd}）より前に設定してください`);
            return;
        }
    }
    
    // 字幕解析タブの開始時間を更新
    document.getElementById('analyze-start-time').value = timeString;
    
    // 範囲を保存
    const analysisRange = {
        start: timeString,
        end: currentProject.analysisRange?.end || ''
    };
    
    try {
        await updateAnalysisRangeAPI(analysisRange);
        
        // currentProjectの範囲情報を更新
        if (!currentProject.analysisRange) {
            currentProject.analysisRange = {};
        }
        currentProject.analysisRange.start = timeString;
        
        showInfo(`開始位置を ${timeString} に設定しました`);
        
        // プレビュー表示を更新
        updateVideoDetails();
    } catch (error) {
        showError('開始位置の保存に失敗しました');
    }
}

// 現在位置を終了位置に設定
async function setEndPosition(event) {
    event.preventDefault();
    const previewVideo = document.getElementById('preview-video');
    
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (previewVideo.readyState < 1) {
        showError('動画が読み込まれていません');
        return;
    }
    
    const currentTime = previewVideo.currentTime;
    const timeString = secondsToTimeString(currentTime);
    
    // 既存の開始位置をチェック
    const existingStart = currentProject.analysisRange?.start;
    if (existingStart) {
        const startTime = parseTimeToSeconds(existingStart);
        if (currentTime <= startTime) {
            showError(`終了位置（${timeString}）は開始位置（${existingStart}）より後に設定してください`);
            return;
        }
    }
    
    // 字幕解析タブの終了時間を更新
    document.getElementById('analyze-end-time').value = timeString;
    
    // 範囲を保存
    const analysisRange = {
        start: currentProject.analysisRange?.start || '',
        end: timeString
    };
    
    try {
        await updateAnalysisRangeAPI(analysisRange);
        
        // currentProjectの範囲情報を更新
        if (!currentProject.analysisRange) {
            currentProject.analysisRange = {};
        }
        currentProject.analysisRange.end = timeString;
        
        showInfo(`終了位置を ${timeString} に設定しました`);
        
        // プレビュー表示を更新
        updateVideoDetails();
    } catch (error) {
        showError('終了位置の保存に失敗しました');
    }
}

// キーボードショートカット設定
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // プレビュータブがアクティブでない場合は無効
        const previewTab = document.getElementById('preview-tab');
        if (!previewTab.classList.contains('active')) return;
        
        // 入力フィールドにフォーカスがある場合は無効
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        
        const previewVideo = document.getElementById('preview-video');
        if (previewVideo.readyState < 1) return;
        
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                skipVideo(-5);
                break;
            case 'ArrowRight':
                event.preventDefault();
                skipVideo(5);
                break;
            case 'j':
                event.preventDefault();
                skipVideo(-10);
                break;
            case 'l':
                event.preventDefault();
                skipVideo(10);
                break;
            case ' ':
                event.preventDefault();
                if (previewVideo.paused) {
                    previewVideo.play();
                } else {
                    previewVideo.pause();
                }
                break;
        }
    });
}

// 動画スキップ機能
function skipVideo(seconds) {
    const previewVideo = document.getElementById('preview-video');
    
    if (previewVideo.readyState < 1) {
        showError('動画が読み込まれていません');
        return;
    }
    
    // 一時的に範囲制限を無効化
    const wasRangeModeActive = !!previewVideo._rangeCheckHandler;
    if (wasRangeModeActive) {
        clearVideoRange(previewVideo);
    }
    
    const newTime = Math.max(0, Math.min(previewVideo.currentTime + seconds, previewVideo.duration));
    previewVideo.currentTime = newTime;
    
    // 範囲制限が有効だった場合、位置移動なしで再度有効化
    if (wasRangeModeActive) {
        enableRangeCheck(previewVideo);
        // 範囲モード継続中
        updatePlayModeButtons('range');
    } else {
        // スキップでボタン状態をリセット
        updatePlayModeButtons('none');
    }
    
    const timeString = secondsToTimeString(newTime);
    const action = seconds > 0 ? '進む' : '戻る';
    showInfo(`${Math.abs(seconds)}秒${action} → ${timeString}`);
}

// 動画をダウンロード
function downloadFinalVideo(event) {
    console.log('🔴 downloadFinalVideo clicked - event:', event.type, 'preventDefault called');
    event.preventDefault();
    
    const video = document.getElementById('result-video');
    if (!video.src) {
        showError('ダウンロードする動画がありません');
        return;
    }
    
    // プログラム的にダウンロードを実行
    const link = document.createElement('a');
    link.href = video.src;
    link.download = currentProject ? `${currentProject.videoId}_final.mp4` : 'final_video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showInfo('動画のダウンロードを開始しました');
}

// workdirにCSVを保存
async function saveCSVToWorkdir(csvContent) {
    const response = await fetch(`/api/projects/${currentProject.videoId}/csv`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent })
    });
    
    if (!response.ok) {
        throw new Error('CSVの保存に失敗しました');
    }
}

// 高画質版を再ダウンロード
async function redownloadHighQuality(event) {
    if (event) event.preventDefault();
    
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
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
        
        // プロジェクト情報を再取得
        await selectProject(currentProject.videoId);
        
    } catch (error) {
        console.error('再ダウンロードエラー:', error);
        showError(error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        isProcessing = false;
    }
}

// 解析用動画を再圧縮
async function recompressAnalysisVideo(event) {
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
    
    isProcessing = true;
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
        
        // プロジェクト情報を再取得
        await selectProject(currentProject.videoId);
        
    } catch (error) {
        console.error('再圧縮エラー:', error);
        showError(error.message);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
        isProcessing = false;
    }
}

// 解析範囲更新API呼び出し
async function updateAnalysisRangeAPI(analysisRange) {
    const response = await fetch(`/api/projects/${currentProject.videoId}/analysis-range`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisRange: Object.keys(analysisRange).length > 0 ? analysisRange : null })
    });
    
    if (!response.ok) {
        throw new Error('解析範囲の保存に失敗しました');
    }
    
    // プロジェクト情報を更新
    currentProject.analysisRange = Object.keys(analysisRange).length > 0 ? analysisRange : null;
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

// 動画編集用のCSVを読み込み
async function loadCSVForEdit() {
    if (!currentProject || !currentProject.files.subtitles) return;
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}/csv`);
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('csv-editor-content').value = data.csvContent;
            // プレビューを更新
            updateFontPreview();
        }
    } catch (error) {
        console.log('動画編集用CSV読み込みエラー:', error.message);
    }
}

// 字幕確認用動画を生成
async function generatePreviewVideo(event) {
    if (event) event.preventDefault();
    if (!currentProject || !currentProject.files.analysis) {
        showError('解析用動画がダウンロードされていません');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value.trim();
    if (!csvContent) {
        showError('字幕データが入力されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    
    try {
        updateProgress('process-progress', 10, 'CSVを保存中...');
        
        // 最新のCSVをプロジェクトに上書き保存
        await saveCSVToWorkdir(csvContent);
        
        updateProgress('process-progress', 20, 'CSVをアップロード中...');
        
        // CSVをアップロード
        const formData = new FormData();
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        formData.append('csv', csvBlob, 'subtitles.csv');
        
        const uploadRes = await fetch('/api/upload-csv', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadRes.ok) {
            throw new Error('CSVアップロードに失敗しました');
        }
        
        const uploadData = await uploadRes.json();
        
        // セッションIDを生成
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // SSE接続を開始
        const eventSource = new EventSource(`/api/process/progress/${sessionId}`);
        let eventSourceClosed = false;
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connected':
                    updateProgress('process-progress', 60, '字幕確認用動画を生成中...');
                    break;
                    
                case 'progress':
                    const percentage = Math.round((data.current / data.total) * 35) + 60; // 60-95%の範囲
                    const progressText = `セグメント ${data.current}/${data.total} を処理中... (開始: ${data.segment.start}, 終了: ${data.segment.end})`;
                    updateProgress('process-progress', percentage, progressText);
                    break;
                    
                case 'complete':
                    updateProgress('process-progress', 100, '完了！');
                    
                    // 結果表示
                    const video = document.getElementById('result-video');
                    video.src = data.outputPath;
                    document.getElementById('video-result').style.display = 'block';
                    
                    showInfo('字幕確認用動画が生成されました');
                    if (!eventSourceClosed) {
                        eventSource.close();
                        eventSourceClosed = true;
                    }
                    break;
            }
        };
        
        eventSource.onerror = () => {
            if (!eventSourceClosed) {
                eventSource.close();
                eventSourceClosed = true;
            }
        };
        
        // フォント設定を取得
        const selectedFont = document.getElementById('subtitle-font').value;
        
        // 動画処理（解析用動画を使用 - 高速）
        const processRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentProject.files.analysis,
                csvPath: uploadData.path,
                sessionId: sessionId,
                font: selectedFont
            })
        });
        
        if (!processRes.ok) {
            const error = await processRes.json();
            if (!eventSourceClosed) {
                eventSource.close();
                eventSourceClosed = true;
            }
            throw new Error(error.error || '字幕確認用動画の生成に失敗しました');
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessing = false;
        setTimeout(() => {
            document.getElementById('process-progress').style.display = 'none';
        }, 2000);
    }
}

// 正式動画を生成
async function generateFinalVideo(event) {
    if (event) event.preventDefault();
    if (!currentProject || !currentProject.files.highQuality) {
        showError('高画質動画がダウンロードされていません');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value.trim();
    if (!csvContent) {
        showError('字幕データが入力されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    isProcessing = true;
    
    try {
        updateProgress('process-progress', 10, 'CSVを保存中...');
        
        // 最新のCSVをプロジェクトに上書き保存
        await saveCSVToWorkdir(csvContent);
        
        updateProgress('process-progress', 20, 'CSVをアップロード中...');
        
        // CSVをアップロード
        const formData = new FormData();
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        formData.append('csv', csvBlob, 'subtitles.csv');
        
        const uploadRes = await fetch('/api/upload-csv', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadRes.ok) {
            throw new Error('CSVアップロードに失敗しました');
        }
        
        const uploadData = await uploadRes.json();
        
        // セッションIDを生成
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // SSE接続を開始
        const eventSource = new EventSource(`/api/process/progress/${sessionId}`);
        let eventSourceClosed = false;
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connected':
                    updateProgress('process-progress', 60, '正式動画を生成中...');
                    break;
                    
                case 'progress':
                    const percentage = Math.round((data.current / data.total) * 35) + 60; // 60-95%の範囲
                    const progressText = `セグメント ${data.current}/${data.total} を処理中... (開始: ${data.segment.start}, 終了: ${data.segment.end})`;
                    updateProgress('process-progress', percentage, progressText);
                    break;
                    
                case 'complete':
                    updateProgress('process-progress', 100, '完了！');
                    
                    // 結果表示
                    const video = document.getElementById('result-video');
                    video.src = data.outputPath;
                    document.getElementById('video-result').style.display = 'block';
                    
                    showInfo('正式動画が生成されました');
                    if (!eventSourceClosed) {
                        eventSource.close();
                        eventSourceClosed = true;
                    }
                    break;
            }
        };
        
        eventSource.onerror = () => {
            if (!eventSourceClosed) {
                eventSource.close();
                eventSourceClosed = true;
            }
        };
        
        // フォント設定を取得
        const selectedFont = document.getElementById('subtitle-font').value;
        
        // 動画処理（高画質版を使用 - 高品質）
        const processRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: currentProject.files.highQuality,
                csvPath: uploadData.path,
                sessionId: sessionId,
                font: selectedFont
            })
        });
        
        if (!processRes.ok) {
            const error = await processRes.json();
            if (!eventSourceClosed) {
                eventSource.close();
                eventSourceClosed = true;
            }
            throw new Error(error.error || '正式動画の生成に失敗しました');
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessing = false;
        setTimeout(() => {
            document.getElementById('process-progress').style.display = 'none';
        }, 2000);
    }
}

// 動画処理（旧）
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

// フォントプレビューの更新
function updateFontPreview() {
    const selectedFont = document.getElementById('subtitle-font').value;
    const previewList = document.getElementById('subtitle-preview-list');
    
    if (!previewList) return;
    
    // システムフォントをそのまま使用（フォールバック付き）
    const fontFamily = `"${selectedFont}", Arial, sans-serif`;
    
    // CSVコンテンツを取得
    const csvContent = document.getElementById('csv-editor-content')?.value;
    
    if (!csvContent || csvContent.trim() === '') {
        previewList.innerHTML = '<p class="preview-placeholder">CSVデータを読み込むと、ここに字幕が表示されます</p>';
        return;
    }
    
    // CSVをパース
    const lines = csvContent.trim().split('\n');
    const segments = [];
    
    // ヘッダーをスキップしてデータを読み込む（全件）
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length >= 3) {
            segments.push({
                start: values[0],
                end: values[1],
                text: values[2]
            });
        }
    }
    
    // プレビューを生成
    if (segments.length === 0) {
        previewList.innerHTML = '<p class="preview-placeholder">有効な字幕データが見つかりません</p>';
        return;
    }
    
    let previewHTML = '';
    segments.forEach((segment, index) => {
        const uniqueId = `subtitle-${index}`;
        previewHTML += `<p id="${uniqueId}" class="subtitle-text">${escapeHtml(segment.text)}</p>`;
    });
    
    previewList.innerHTML = previewHTML;
    
    // HTMLを設定した後、各要素に直接フォントを適用
    segments.forEach((segment, index) => {
        const element = document.getElementById(`subtitle-${index}`);
        if (element) {
            element.style.cssText = `font-family: ${fontFamily} !important; margin: 0 0 5px 0; color: #333;`;
            
            // デバッグ用：フォントが正しく適用されているか確認
            console.log(`Element ${index}:`, {
                selectedFont,
                appliedFont: fontFamily,
                computedFont: window.getComputedStyle(element).fontFamily,
                element: element
            });
        }
    });
}

// CSVの行をパースする関数
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    values.push(current.trim());
    return values;
}