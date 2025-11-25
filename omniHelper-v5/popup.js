// OmniChat AutoResponder Popup

document.addEventListener('DOMContentLoaded', init);

function init() {
    loadState();
    setupListeners();
    setInterval(loadState, 3000);
}

function loadState() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                updateStatus(false, 'Не на OmniChat');
                return;
            }
            
            const stats = response.stats;
            
            // Update stats
            document.getElementById('processedCount').textContent = stats.processedAppeals || 0;
            document.getElementById('queueLength').textContent = stats.queueLength || 0;
            
            // Update toggle
            document.getElementById('autoToggle').checked = stats.autoResponseEnabled;
            
            // Update status
            if (stats.isProcessing) {
                updateStatus('processing', 'Обработка...');
            } else if (stats.autoResponseEnabled) {
                updateStatus(true, 'Активен');
            } else {
                updateStatus(false, 'Выключен');
            }
            
            // Load queue
            loadQueue();
        });
    });
}

function loadQueue() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getQueue' }, (response) => {
            if (!response?.success) return;
            
            const container = document.getElementById('queueList');
            const queue = response.queue || [];
            
            if (queue.length === 0) {
                container.innerHTML = '<div class="queue-empty">Пусто</div>';
                return;
            }
            
            container.innerHTML = queue.map((item, i) => `
                <div class="queue-item">
                    <span class="queue-id">${item.appealId}</span>
                    <span class="queue-status ${i === 0 ? 'processing' : 'pending'}">
                        ${i === 0 ? 'обработка' : 'ожидание'}
                    </span>
                </div>
            `).join('');
        });
    });
}

function updateStatus(state, text) {
    const dot = document.getElementById('statusDot');
    const label = document.getElementById('statusText');
    
    dot.className = 'status-dot';
    if (state === 'processing') {
        dot.classList.add('processing');
    } else if (!state) {
        dot.classList.add('off');
    }
    
    label.textContent = text;
}

function setupListeners() {
    // Toggle auto-response
    document.getElementById('autoToggle').addEventListener('change', (e) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleAutoResponse' });
        });
    });
    
    // Check button
    document.getElementById('checkBtn').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'checkAppeals' }, () => {
                setTimeout(loadState, 500);
            });
        });
    });
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
        if (!confirm('Очистить очередь и историю?')) return;
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearData' }, () => {
                loadState();
            });
        });
    });
}
