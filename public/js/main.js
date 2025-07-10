// 他モジュールから必要な関数をインポート
import { loadProjects, currentProject, projects, isProcessing, setupProjectEventListeners } from './project.js';
import { setupTabs } from './tabs.js';
import { setupVideoEventHandlers } from './video.js';
import { setupSubtitleEventListeners } from './subtitle.js';

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    await loadSystemFonts();
    setupTabs();
    setupProjectEventListeners();
    setupVideoEventHandlers();
    setupSubtitleEventListeners();
    setupKeyboardShortcuts();
});

// システムフォント一覧を読み込み
async function loadSystemFonts() {
    try {
        console.log('📝 システムフォント一覧を読み込み中...');
        const response = await fetch('/api/fonts');
        const data = await response.json();
        
        if (data.success) {
            const fontSelect = document.getElementById('subtitle-font');
            if (fontSelect) {
                fontSelect.innerHTML = '';
                
                data.fonts.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font.name;
                    option.textContent = font.displayName;
                    fontSelect.appendChild(option);
                });
                
                fontSelect.value = 'Arial';
                console.log(`✅ ${data.fonts.length}個のシステムフォントを読み込み完了`);
                
                if (data.fallback) {
                    console.warn('⚠️ フォールバックフォントを使用中');
                }
            }
        }
    } catch (error) {
        console.error('❌ システムフォント読み込みエラー:', error);
        
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

// エラー表示
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// キーボードショートカット設定
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    if (currentProject) {
                        const activeTab = document.querySelector('.tab-btn.active');
                        if (activeTab) {
                            const tab = activeTab.dataset.tab;
                            if (tab === 'analyze') {
                                document.getElementById('start-analysis-btn').click();
                            } else if (tab === 'edit') {
                                document.getElementById('final-video-btn').click();
                            }
                        }
                    }
                    break;
            }
        }
    });
}