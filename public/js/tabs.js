/**
 * タブ切り替え機能モジュール
 */

// タブ切り替え機能を初期化
export function setupTabs() {
    // タブボタンにイベントリスナーを設定
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            showTab(tabName);
        });
    });
}

// 指定されたタブを表示
export function showTab(tabName) {
    // すべてのタブボタンから active クラスを削除
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // すべてのタブコンテンツを非表示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 指定されたタブボタンに active クラスを追加
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    // 指定されたタブコンテンツを表示
    const targetContent = document.getElementById(`${tabName}-tab`);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}