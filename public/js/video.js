/**
 * 動画関連モジュール
 * 動画のプレビュー、スキップ機能、範囲設定、再生制御、ダウンロード機能を提供
 */

import { 
    parseTimeToSeconds, 
    secondsToTimeString, 
    showError, 
    showInfo 
} from './utils.js';
import { currentProject, setCurrentProject } from './project.js';

// 再生範囲が動画全体と同じかどうかを判定
function isRangeEqualsFullVideo(analysisRange, videoDuration) {
    if (!analysisRange || !videoDuration) return false;
    
    const start = analysisRange.start;
    const end = analysisRange.end;
    
    // 開始時間が0または空で、終了時間が動画の尺と同じ場合
    const startSeconds = start ? parseTimeToSeconds(start) : 0;
    const endSeconds = end ? parseTimeToSeconds(end) : videoDuration;
    
    // 許容誤差1秒で比較（動画の尺は小数点以下がある場合があるため）
    const tolerance = 1;
    return Math.abs(startSeconds - 0) < tolerance && 
           Math.abs(endSeconds - videoDuration) < tolerance;
}

// プレビューを更新
export function updatePreview() {
    const previewVideo = document.getElementById('preview-video');
    const previewSelect = document.getElementById('preview-select');
    const videoDetails = document.getElementById('video-details');
    
    if (!currentProject) return;
    
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
    
    if (!rangeBtn || !fullBtn) return;
    
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
    const cropSection = document.querySelector('.crop-section');
    
    if (!currentProject || !previewSelect) {
        return;
    }
    
    const selectedType = previewSelect.value;
    const videoPath = selectedType === 'high' ? currentProject.files.highQuality : currentProject.files.analysis;
    
    // 再生範囲が全体かどうかを判定
    const isFullRange = !currentProject.analysisRange || 
                       (!currentProject.analysisRange.start && !currentProject.analysisRange.end) ||
                       isRangeEqualsFullVideo(currentProject.analysisRange, currentProject.duration);
    
    // 範囲表示を更新
    const rangeText = isFullRange ? 
        '再生範囲: 全体' :
        `再生範囲: ${currentProject.analysisRange.start || '0:00'} 〜 ${currentProject.analysisRange.end || '終了まで'}`;
    
    if (rangeDisplay) {
        rangeDisplay.textContent = rangeText;
    }
    
    // クロップセクションの表示/非表示を制御
    if (cropSection) {
        if (isFullRange) {
            cropSection.style.display = 'none';
        } else {
            cropSection.style.display = 'block';
        }
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

// 動画の範囲制限をクリア（通常再生）
export function clearVideoRange(videoElement) {
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

// 範囲リピート再生
export function playVideoRange(event) {
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
export function playFullVideo(event) {
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
export async function setStartPosition(event) {
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
export async function setEndPosition(event) {
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

// 動画スキップ機能
export function skipVideo(seconds) {
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
export function downloadFinalVideo(event) {
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

// 完成動画用の制御関数
let resultVideoRange = { start: null, end: null };

// 完成動画のスキップ機能
export function skipResultVideo(seconds) {
    const resultVideo = document.getElementById('result-video');
    
    if (resultVideo.readyState < 1) {
        showError('動画が読み込まれていません');
        return;
    }
    
    const newTime = Math.max(0, Math.min(resultVideo.currentTime + seconds, resultVideo.duration));
    resultVideo.currentTime = newTime;
    
    const timeString = secondsToTimeString(newTime);
    const action = seconds > 0 ? '進む' : '戻る';
    showInfo(`${Math.abs(seconds)}秒${action} → ${timeString}`);
}

// 詳細情報ページの完成動画表示を更新
export function updateDetailFinalVideo() {
    const finalVideoSection = document.getElementById('final-video-section');
    const detailFinalVideo = document.getElementById('detail-final-video');
    
    // 完成動画のパスをチェック
    const hasFinalVideo = checkForFinalVideo();
    
    if (hasFinalVideo) {
        finalVideoSection.style.display = 'block';
        detailFinalVideo.src = hasFinalVideo;
        detailFinalVideo.style.display = 'block';
    } else {
        finalVideoSection.style.display = 'none';
    }
}

// 完成動画の存在チェック
function checkForFinalVideo() {
    if (!currentProject) return false;
    
    // project.jsonのdisplayInfoに完成動画パスがあるかチェック
    if (currentProject.displayInfo && currentProject.displayInfo.finalVideoPath) {
        // プロジェクトに保存された完成動画のパスを使用
        const videoId = currentProject.videoId;
        const filename = currentProject.displayInfo.finalVideoFilename || 'final_video.mp4';
        return `/api/projects/${videoId}/video/${filename}`;
    }
    
    // 編集タブの結果動画があるかチェック（互換性のため）
    const resultVideo = document.getElementById('result-video');
    if (resultVideo && resultVideo.src) {
        return resultVideo.src;
    }
    
    return false;
}

// 詳細情報ページの完成動画用制御関数
let detailVideoRange = { start: null, end: null };

// 詳細情報ページの完成動画のスキップ機能
export function skipDetailVideo(seconds) {
    const detailVideo = document.getElementById('detail-final-video');
    
    if (detailVideo.readyState < 1) {
        showError('動画が読み込まれていません');
        return;
    }
    
    const newTime = Math.max(0, Math.min(detailVideo.currentTime + seconds, detailVideo.duration));
    detailVideo.currentTime = newTime;
    
    const timeString = secondsToTimeString(newTime);
    const action = seconds > 0 ? '進む' : '戻る';
    showInfo(`${Math.abs(seconds)}秒${action} → ${timeString}`);
}

// 詳細情報ページの完成動画をダウンロード
export function downloadDetailFinalVideo(event) {
    if (event) event.preventDefault();
    
    const detailVideo = document.getElementById('detail-final-video');
    if (!detailVideo.src) {
        showError('ダウンロード可能な動画がありません');
        return;
    }
    
    // ダウンロードリンクを作成
    const link = document.createElement('a');
    link.href = detailVideo.src;
    link.download = `${currentProject?.videoId || 'video'}_final.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showInfo('完成動画のダウンロードを開始しました');
}

// キーボードショートカット設定
export function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // プレビュータブがアクティブでない場合は無効
        const previewTab = document.getElementById('preview-tab');
        if (!previewTab || !previewTab.classList.contains('active')) return;
        
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

// 動画関連のイベントリスナーをセットアップ
export function setupVideoEventHandlers() {
    // プレビューコントロール
    document.getElementById('play-range-btn')?.addEventListener('click', playVideoRange);
    document.getElementById('play-full-btn')?.addEventListener('click', playFullVideo);
    document.getElementById('set-start-btn')?.addEventListener('click', setStartPosition);
    document.getElementById('set-end-btn')?.addEventListener('click', setEndPosition);
    
    // スキップコントロール
    document.getElementById('back-1s-btn')?.addEventListener('click', () => skipVideo(-1));
    document.getElementById('forward-1s-btn')?.addEventListener('click', () => skipVideo(1));
    document.getElementById('back-5s-btn')?.addEventListener('click', () => skipVideo(-5));
    document.getElementById('forward-5s-btn')?.addEventListener('click', () => skipVideo(5));
    document.getElementById('back-10s-btn')?.addEventListener('click', () => skipVideo(-10));
    document.getElementById('forward-10s-btn')?.addEventListener('click', () => skipVideo(10));
    
    // 完成動画用コントロール
    document.getElementById('result-back-1s-btn')?.addEventListener('click', () => skipResultVideo(-1));
    document.getElementById('result-forward-1s-btn')?.addEventListener('click', () => skipResultVideo(1));
    document.getElementById('result-back-5s-btn')?.addEventListener('click', () => skipResultVideo(-5));
    document.getElementById('result-forward-5s-btn')?.addEventListener('click', () => skipResultVideo(5));
    document.getElementById('result-back-10s-btn')?.addEventListener('click', () => skipResultVideo(-10));
    document.getElementById('result-forward-10s-btn')?.addEventListener('click', () => skipResultVideo(10));
    
    // 詳細情報ページの完成動画用コントロール
    document.getElementById('detail-back-1s-btn')?.addEventListener('click', () => skipDetailVideo(-1));
    document.getElementById('detail-forward-1s-btn')?.addEventListener('click', () => skipDetailVideo(1));
    document.getElementById('detail-back-5s-btn')?.addEventListener('click', () => skipDetailVideo(-5));
    document.getElementById('detail-forward-5s-btn')?.addEventListener('click', () => skipDetailVideo(5));
    document.getElementById('detail-back-10s-btn')?.addEventListener('click', () => skipDetailVideo(-10));
    document.getElementById('detail-forward-10s-btn')?.addEventListener('click', () => skipDetailVideo(10));
    document.getElementById('detail-download-final-video')?.addEventListener('click', downloadDetailFinalVideo);
    
    // 動画ダウンロード
    document.getElementById('download-processed-video')?.addEventListener('click', downloadFinalVideo);
}

// グローバル関数として公開
window.updatePreview = updatePreview;
window.updateDetailFinalVideo = updateDetailFinalVideo;