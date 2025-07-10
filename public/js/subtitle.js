/**
 * 字幕関連機能モジュール
 * 字幕解析、CSV処理、動画生成、フォントプレビュー機能を提供
 */

import { 
    parseTimeToSeconds,
    secondsToTimeString,
    formatDuration,
    escapeHtml,
    updateProgress,
    hideProgress,
    showError,
    showInfo,
    parseCSVLine,
    fillGapsInCSV
} from './utils.js';

import { currentProject, isProcessing, setIsProcessing, loadProjects, selectProject } from './project.js';

// 字幕解析を開始
export async function startAnalysis() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    setIsProcessing(true);
    updateProgress('analysis-progress', 0, '解析を開始しています...');
    
    try {
        const startTime = document.getElementById('analyze-start-time').value.trim();
        const endTime = document.getElementById('analyze-end-time').value.trim();
        
        const requestBody = {
            projectId: currentProject.videoId,
            startTime: startTime || undefined,
            endTime: endTime || undefined
        };
        
        updateProgress('analysis-progress', 50, '音声認識中...');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '解析に失敗しました');
        }
        
        const result = await response.json();
        
        updateProgress('analysis-progress', 100, '解析完了');
        
        // CSVを表示
        document.getElementById('csv-result').style.display = 'block';
        document.getElementById('csv-content').value = result.csvContent;
        document.getElementById('csv-editor-content').value = result.csvContent;
        
        // ボタンの表示状態を更新
        document.getElementById('start-analysis-btn').style.display = 'none';
        document.getElementById('reanalyze-btn').style.display = 'inline-block';
        
        hideProgress('analysis-progress');
        
        // フォントプレビューを更新（少し遅延させる）
        setTimeout(() => {
            updateFontPreview();
        }, 100);
        
        setIsProcessing(false);
        showInfo('解析が完了しました');
        
    } catch (error) {
        console.error('解析エラー:', error);
        showError(error.message || '字幕解析に失敗しました');
        hideProgress('analysis-progress');
        setIsProcessing(false);
    }
}

// 解析結果を表示
function displayAnalysisResult(csvContent) {
    document.getElementById('csv-result').style.display = 'block';
    document.getElementById('csv-content').value = csvContent;
    
    // CSVエディタにも同じ内容を設定
    document.getElementById('csv-editor-content').value = csvContent;
    
    // ボタンの表示状態を更新
    document.getElementById('start-analysis-btn').style.display = 'none';
    document.getElementById('reanalyze-btn').style.display = 'inline-block';
    
    hideProgress('analysis-progress');
    
    // フォントプレビューを更新
    updateFontPreview();
}

// 再解析
export async function reAnalyze() {
    // 結果エリアを非表示にして再解析
    document.getElementById('start-analysis-btn').style.display = 'inline-block';
    document.getElementById('reanalyze-btn').style.display = 'none';
    
    // 結果エリアを非表示
    document.getElementById('csv-result').style.display = 'none';
    
    await startAnalysis();
}

// フォントプレビューを更新
export function updateFontPreview() {
    const csvContent = document.getElementById('csv-editor-content').value;
    const selectedFont = document.getElementById('subtitle-font').value;
    const previewList = document.getElementById('subtitle-preview-list');
    
    if (!csvContent.trim()) {
        previewList.innerHTML = '<p class="preview-placeholder">CSVデータを読み込むと、ここに字幕が表示されます</p>';
        return;
    }
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // ヘッダー行をスキップ（もしあれば）
    const dataLines = lines[0].includes('start_time') ? lines.slice(1) : lines;
    
    const subtitles = dataLines.map(line => {
        const values = parseCSVLine(line);
        if (values.length >= 3) {
            return {
                start: values[0],
                end: values[1], 
                text: values[2] || ''  // 空の場合も含める
            };
        }
        return null;
    }).filter(subtitle => subtitle !== null);
    
    if (subtitles.length === 0) {
        previewList.innerHTML = '<p class="preview-placeholder">有効な字幕データがありません</p>';
        return;
    }
    
    // 最初の10行を表示
    const previewSubtitles = subtitles.slice(0, 10);
    
    previewList.innerHTML = previewSubtitles.map(subtitle => `
        <div class="subtitle-preview-item" style="font-family: '${selectedFont}', Arial, sans-serif;">
            ${subtitle.text.trim() ? escapeHtml(subtitle.text) : '<span style="color: #999;">(無音)</span>'}
        </div>
    `).join('');
}

// CSV保存
export async function saveCSVToProject() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    const csvContent = document.getElementById('csv-content').value;
    
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
    } catch (error) {
        showError(error.message);
    }
}

// クロップ機能
export async function createCropProjectFromPreviewRange() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    try {
        // プレビューページの範囲設定から値を取得
        let startTimeInput, endTimeInput;
        
        if (currentProject.analysisRange) {
            startTimeInput = currentProject.analysisRange.start;
            endTimeInput = currentProject.analysisRange.end;
        }
        
        if (!startTimeInput || !endTimeInput) {
            showError('プレビューページで開始時間と終了時間を両方設定してください');
            return;
        }
        
        setIsProcessing(true);
        
        // クロップ用モーダルを表示
        showCropCreationProgress();
        
        // 時間の妥当性チェック
        const startSeconds = parseTimeToSeconds(startTimeInput);
        const endSeconds = parseTimeToSeconds(endTimeInput);
        
        if (isNaN(startSeconds) || isNaN(endSeconds)) {
            throw new Error('無効な時間形式です。MM:SS.sss の形式で入力してください');
        }
        
        if (startSeconds >= endSeconds) {
            throw new Error('開始時間は終了時間より前である必要があります');
        }
        
        if (startSeconds < 0 || endSeconds < 0) {
            throw new Error('時間は0以上である必要があります');
        }
        
        if (endSeconds - startSeconds < 1) {
            throw new Error('クロップ範囲は最低1秒以上である必要があります');
        }
        
        updateCropCreationProgress({ 
            message: 'クロップ範囲を確認中...', 
            progress: 10 
        });
        
        // 画面を最上位までスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        updateCropCreationProgress({ 
            message: 'クロップ動画を生成中...', 
            progress: 30 
        });
        
        // 統合されたクロップ+新プロジェクト作成APIを呼び出し
        const response = await fetch('/api/video/crop-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProject.videoId,
                startTime: startTimeInput,
                endTime: endTimeInput,
                sessionId: `crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'クロップ動画の生成に失敗しました');
        }
        
        const result = await response.json();
        
        updateCropCreationProgress({ 
            message: '新プロジェクトを作成中...', 
            progress: 80 
        });
        
        // プロジェクト一覧を更新して新プロジェクトを選択
        await loadProjects();
        
        updateCropCreationProgress({ 
            message: '新プロジェクトが作成されました', 
            progress: 100 
        });
        
        setTimeout(async () => {
            hideCropCreationProgress();
            showInfo('新プロジェクトが作成されました');
            selectProject(result.newProjectId);
        }, 1000);
        
    } catch (error) {
        console.error('クロップエラー:', error);
        showError(error.message || 'クロップ動画の生成に失敗しました');
        hideCropCreationProgress();
    } finally {
        setIsProcessing(false);
    }
}

// 解析範囲保存
export async function saveAnalysisRange() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    const startTime = document.getElementById('analyze-start-time').value.trim();
    const endTime = document.getElementById('analyze-end-time').value.trim();
    
    try {
        const response = await fetch(`/api/projects/${currentProject.videoId}/analysis-range`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start: startTime || null,
                end: endTime || null
            })
        });
        
        if (!response.ok) {
            throw new Error('解析範囲の保存に失敗しました');
        }
        
        // currentProjectを更新
        currentProject.analysisRange = {
            start: startTime || null,
            end: endTime || null
        };
        
        // プレビュー表示を更新（クロップセクションの表示制御を反映）
        if (window.updatePreview) {
            window.updatePreview();
        }
        
        showInfo('解析範囲を保存しました');
    } catch (error) {
        showError(error.message);
    }
}

// 動画編集タブのCSV保存
async function saveEditedCSV() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value;
    
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
    } catch (error) {
        showError(error.message);
    }
}

// 動画編集タブのCSVダウンロード
function downloadEditedCSV() {
    const csvContent = document.getElementById('csv-editor-content').value;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.videoId || 'subtitles'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// プレビュー動画生成
async function generatePreviewVideo() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value;
    if (!csvContent.trim()) {
        showError('CSVデータがありません');
        return;
    }
    
    setIsProcessing(true);
    updateProgress('process-progress', 0, 'プレビュー動画を生成中...');
    
    try {
        const selectedFont = document.getElementById('subtitle-font').value;
        
        // CSVを一時保存
        await saveEditedCSV();
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: `workdir/${currentProject.videoId}/video_high.mp4`,
                csvPath: `workdir/${currentProject.videoId}/subtitles.csv`,
                font: selectedFont,
                sessionId: `preview_${Date.now()}`,
                projectId: currentProject.videoId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'プレビュー動画の生成に失敗しました');
        }
        
        const result = await response.json();
        console.log('プレビュー動画生成結果:', result);
        
        if (result.success) {
            updateProgress('process-progress', 100, 'プレビュー動画完成');
            hideProgress('process-progress');
            
            // プレビュー動画を表示
            const resultVideo = document.getElementById('result-video');
            const videoPath = result.outputPath || result.videoPath;
            console.log('動画パス:', videoPath);
            resultVideo.src = videoPath;
            document.getElementById('video-result').style.display = 'block';
            
            showInfo('プレビュー動画が生成されました');
        } else {
            throw new Error(result.error || 'プレビュー動画の生成に失敗しました');
        }
        
        setIsProcessing(false);
        
    } catch (error) {
        console.error('プレビュー動画生成エラー:', error);
        showError(error.message || 'プレビュー動画の生成に失敗しました');
        hideProgress('process-progress');
        setIsProcessing(false);
    }
}

// 最終動画生成
async function generateFinalVideo() {
    if (!currentProject) {
        showError('プロジェクトが選択されていません');
        return;
    }
    
    if (isProcessing) {
        showError('他の処理が実行中です');
        return;
    }
    
    const csvContent = document.getElementById('csv-editor-content').value;
    if (!csvContent.trim()) {
        showError('CSVデータがありません');
        return;
    }
    
    setIsProcessing(true);
    updateProgress('process-progress', 0, '最終動画を生成中...');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    try {
        const selectedFont = document.getElementById('subtitle-font').value;
        
        // CSVを一時保存
        await saveEditedCSV();
        
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoPath: `workdir/${currentProject.videoId}/video_high.mp4`,
                csvPath: `workdir/${currentProject.videoId}/subtitles.csv`,
                font: selectedFont,
                sessionId: `final_${Date.now()}`,
                projectId: currentProject.videoId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '最終動画の生成に失敗しました');
        }
        
        const result = await response.json();
        
        if (result.success) {
            updateProgress('process-progress', 100, '最終動画完成');
            hideProgress('process-progress');
            
            // 最終動画を表示
            const resultVideo = document.getElementById('result-video');
            resultVideo.src = result.outputPath || result.videoPath;
            document.getElementById('video-result').style.display = 'block';
            
            showInfo('最終動画が生成されました');
        } else {
            throw new Error(result.error || '最終動画の生成に失敗しました');
        }
        
        setIsProcessing(false);
        
    } catch (error) {
        console.error('最終動画生成エラー:', error);
        showError(error.message || '最終動画の生成に失敗しました');
        hideProgress('process-progress');
        setIsProcessing(false);
    }
}

// イベントリスナーを設定
export function setupSubtitleEventListeners() {
    // 字幕解析
    document.getElementById('start-analysis-btn')?.addEventListener('click', startAnalysis);
    document.getElementById('reanalyze-btn')?.addEventListener('click', reAnalyze);
    
    // 解析範囲保存
    document.getElementById('save-analysis-range-btn')?.addEventListener('click', saveAnalysisRange);
    
    // CSV関連
    document.getElementById('save-csv')?.addEventListener('click', saveCSVToProject);
    
    // 動画編集タブのCSV関連
    document.getElementById('edit-save-csv')?.addEventListener('click', saveEditedCSV);
    document.getElementById('edit-download-csv')?.addEventListener('click', downloadEditedCSV);
    
    // 動画生成ボタン
    document.getElementById('preview-video-btn')?.addEventListener('click', generatePreviewVideo);
    document.getElementById('final-video-btn')?.addEventListener('click', generateFinalVideo);
    
    // フォント選択時のプレビュー更新
    const subtitleFont = document.getElementById('subtitle-font');
    if (subtitleFont) {
        subtitleFont.addEventListener('change', updateFontPreview);
    }
    
    // CSVエディタの内容が変更されたときにプレビューを更新
    const csvEditor = document.getElementById('csv-editor-content');
    if (csvEditor) {
        csvEditor.addEventListener('input', updateFontPreview);
    }
    
    // クロップボタン
    const cropProjectBtn = document.getElementById('create-crop-project-btn');
    if (cropProjectBtn) {
        cropProjectBtn.addEventListener('click', createCropProjectFromPreviewRange);
        console.log('✅ クロッププロジェクト作成ボタンのイベントリスナーを設定');
    } else {
        console.error('❌ create-crop-project-btn要素が見つかりません');
    }
}

// クロップ作成進捗表示
function showCropCreationProgress() {
    // ログエリアを作成
    let logArea = document.getElementById('crop-log-area');
    if (!logArea) {
        logArea = document.createElement('div');
        logArea.id = 'crop-log-area';
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
                <h3 style="margin: 0;">✂️ クロップ動画作成中</h3>
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <div class="progress-bar" style="width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; margin-bottom: 15px;">
                <div class="progress-fill" style="height: 100%; background: #3498db; width: 0%; transition: width 0.3s;"></div>
            </div>
            <div id="crop-log" style="font-family: monospace; font-size: 12px; background: #f8f9fa; border-radius: 4px; padding: 10px; height: 200px; overflow-y: auto; white-space: pre-wrap;"></div>
        `;
        
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
        
        document.body.appendChild(logArea);
    }
    
    logArea.style.display = 'block';
    
    // 初期メッセージ
    const logDiv = document.getElementById('crop-log');
    if (logDiv) {
        logDiv.textContent = '✂️ クロップ動画の作成を開始しています...\n';
    }
}

// クロップ作成進捗更新
function updateCropCreationProgress(data) {
    const logDiv = document.getElementById('crop-log');
    const progressFill = document.querySelector('#crop-log-area .progress-fill');
    
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

// クロップ作成進捗非表示
function hideCropCreationProgress() {
    const logArea = document.getElementById('crop-log-area');
    if (logArea) {
        setTimeout(() => {
            logArea.style.display = 'none';
        }, 2000);
    }
}

// グローバル関数として公開
window.updateFontPreview = updateFontPreview;