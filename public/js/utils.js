/**
 * ユーティリティ関数モジュール
 * 共通のヘルパー関数を提供
 */

// 時間変換関数
export function parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    
    const parts = timeStr.split(':');
    let seconds = 0;
    
    if (parts.length === 1) {
        // 秒のみ（例: "30.500"）
        const value = parseFloat(parts[0]);
        if (isNaN(value)) {
            throw new Error(`無効な時間形式: ${timeStr}`);
        }
        seconds = value;
    } else if (parts.length === 2) {
        // 分:秒（例: "1:30.500"）
        const minutes = parseInt(parts[0]);
        const secs = parseFloat(parts[1]);
        if (isNaN(minutes) || isNaN(secs) || minutes < 0 || secs < 0) {
            throw new Error(`無効な時間形式: ${timeStr}`);
        }
        seconds = minutes * 60 + secs;
    } else if (parts.length === 3) {
        // 時:分:秒（例: "1:05:30.500"）
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const secs = parseFloat(parts[2]);
        if (isNaN(hours) || isNaN(minutes) || isNaN(secs) || hours < 0 || minutes < 0 || secs < 0) {
            throw new Error(`無効な時間形式: ${timeStr}`);
        }
        seconds = hours * 3600 + minutes * 60 + secs;
    } else {
        throw new Error(`無効な時間形式: ${timeStr}`);
    }
    
    return seconds;
}

export function secondsToTimeString(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
}

export function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 時間文字列を秒数に変換する関数（別バージョン）
export function parseTime(timeStr) {
    // hh:mm:ss.sss, mm:ss.sss または ss.sss 形式をパース
    const timeParts = timeStr.split(':');
    
    if (timeParts.length === 3) {
        // hh:mm:ss.sss 形式
        const hours = parseInt(timeParts[0], 10) || 0;
        const mins = parseInt(timeParts[1], 10) || 0;
        const secParts = timeParts[2].split('.');
        const secs = parseInt(secParts[0], 10) || 0;
        const ms = secParts[1] ? parseInt(secParts[1], 10) : 0;
        return hours * 3600 + mins * 60 + secs + ms / 1000;
    } else if (timeParts.length === 2) {
        // mm:ss.sss 形式
        const mins = parseInt(timeParts[0], 10) || 0;
        const secParts = timeParts[1].split('.');
        const secs = parseInt(secParts[0], 10) || 0;
        const ms = secParts[1] ? parseInt(secParts[1], 10) : 0;
        return mins * 60 + secs + ms / 1000;
    } else {
        // ss.sss 形式
        return parseFloat(timeStr) || 0;
    }
}

// エスケープ処理
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 左ペイン用ステータス（プロジェクト全体の状態）
export function getProjectStatus(project) {
    const hasHighQuality = project.files?.highQuality || false;
    const hasAnalysis = project.files?.analysis || false;
    
    if (!hasHighQuality) {
        return { text: '未ダウンロード', class: 'not-downloaded' };
    } else if (hasHighQuality && !hasAnalysis) {
        return { text: '未圧縮', class: 'not-compressed' };
    } else {
        return { text: '準備完了', class: 'ready' };
    }
}

// 詳細画面用ステータス（個別ファイルの状態）
export function getHighQualityStatus(project) {
    if (project.downloadingHigh) {
        return { text: 'ダウンロード中', class: 'downloading' };
    } else if (project.files?.highQuality) {
        return { text: 'ダウンロード済', class: 'downloaded' };
    } else {
        return { text: '未ダウンロード', class: 'not-downloaded' };
    }
}

export function getAnalysisStatus(project) {
    if (project.compressingAnalysis) {
        return { text: '圧縮中', class: 'compressing' };
    } else if (project.files?.analysis) {
        return { text: '圧縮済', class: 'compressed' };
    } else {
        return { text: '未圧縮', class: 'not-compressed' };
    }
}

// 後方互換性のための関数（既存コードで使用されている場合）
export function getStatusClass(status) {
    switch (status) {
        case 'ready': return 'ready';
        case 'downloading': return 'downloading';
        case 'error': return 'error';
        default: return 'not-downloaded';
    }
}

export function getStatusText(status) {
    switch (status) {
        case 'ready': return '準備完了';
        case 'downloading': return 'ダウンロード中';
        case 'error': return 'エラー';
        default: return '未ダウンロード';
    }
}

// プログレス表示
export function updateProgress(progressId, percentage, text) {
    const progressSection = document.getElementById(progressId);
    const progressFill = progressSection.querySelector('.progress-fill');
    const progressText = progressSection.querySelector('.progress-text');
    
    progressSection.style.display = 'block';
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = text;
}

export function hideProgress(progressId) {
    const progressSection = document.getElementById(progressId);
    if (progressSection) {
        progressSection.style.display = 'none';
    }
}

// メッセージ表示
export function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

export function showInfo(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.backgroundColor = '#28a745';
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
        errorDiv.style.backgroundColor = '#dc3545';
    }, 3000);
}

// CSVパース関数
export function parseCSVLine(line) {
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

// CSVの空白を補完する関数
export function fillGapsInCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return csvContent; // ヘッダーのみの場合は何もしない
    
    const header = lines[0];
    const dataLines = lines.slice(1);
    const newLines = [header];
    
    let gapsFound = 0;
    
    for (let i = 0; i < dataLines.length; i++) {
        const currentLine = dataLines[i];
        const values = parseCSVLine(currentLine);
        
        if (values.length < 3) {
            console.warn(`行 ${i + 2} をスキップ: 不正な形式`, currentLine);
            continue; // 不正な行はスキップ
        }
        
        // 現在の行を追加
        newLines.push(currentLine);
        
        // 次の行がある場合、間隔をチェック
        if (i < dataLines.length - 1) {
            const nextValues = parseCSVLine(dataLines[i + 1]);
            if (nextValues.length >= 3) {
                const currentEnd = parseTime(values[1]);
                const nextStart = parseTime(nextValues[0]);
                const gap = nextStart - currentEnd;
                
                console.log(`行 ${i + 2}-${i + 3} 間: 終了=${values[1]}(${currentEnd}秒), 開始=${nextValues[0]}(${nextStart}秒), 間隔=${gap.toFixed(3)}秒`);
                
                // 0.001秒以上の間隔がある場合、空白行を挿入
                if (gap > 0.001) {
                    const gapLine = `${values[1]},${nextValues[0]}," "`;
                    newLines.push(gapLine);
                    gapsFound++;
                    console.log(`空白行を挿入: ${gapLine}`);
                }
            }
        }
    }
    
    console.log(`空白補完完了: ${gapsFound}箇所の空白を挿入`);
    return newLines.join('\n');
}