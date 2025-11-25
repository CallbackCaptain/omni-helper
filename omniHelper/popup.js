// OmniChat Diagnostic Tool Popup JavaScript

// State Management
let currentTab = 'dashboard';
let logs = [];
let stats = {};
let config = {};
let autoRefreshInterval;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadInitialData();
    setupEventListeners();
    startAutoRefresh();
});

// Tab Management
function initializeTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tabs
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Load tab-specific data
    switch(tabName) {
        case 'dashboard':
            refreshDashboard();
            break;
        case 'logs':
            refreshLogs();
            break;
        case 'config':
            loadConfig();
            break;
        case 'history':
            loadHistory();
            break;
    }
}

// Data Loading
function loadInitialData() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        // Get initial stats
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getStats'}, function(response) {
            if (response && response.success) {
                updateStats(response.stats);
            }
        });
        
        // Load config
        loadConfig();
        
        // Load auto-response state
        chrome.storage.local.get(['autoResponseEnabled'], function(result) {
            document.getElementById('autoResponseToggle').checked = result.autoResponseEnabled !== false;
        });
    });
}

// Dashboard Functions
function refreshDashboard() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getStats'}, function(response) {
            if (response && response.success) {
                updateStats(response.stats);
                updateQueue();
                updateRecentActivity();
            }
        });
    });
}

function updateStats(newStats) {
    stats = newStats;
    
    // Update metrics
    document.getElementById('processedCount').textContent = stats.processedAppeals || 0;
    document.getElementById('queueLength').textContent = stats.queueLength || 0;
    
    // Update queue badge
    const queueBadge = document.getElementById('queueBadge');
    if (stats.queueLength > 0) {
        queueBadge.textContent = stats.queueLength;
        queueBadge.style.display = 'inline-block';
    } else {
        queueBadge.style.display = 'none';
    }
    
    // Calculate success rate
    const successRate = stats.processedAppeals > 0 ? 
        Math.round((stats.successCount || 0) / stats.processedAppeals * 100) : 0;
    document.getElementById('successRate').textContent = successRate + '%';
    
    // Update status
    updateSystemStatus();
}

function updateSystemStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (stats.currentUrl && stats.currentUrl.includes('omnichat.rt.ru')) {
        if (stats.isProcessing) {
            statusDot.className = 'status-dot processing';
            statusText.textContent = 'Processing...';
        } else if (stats.autoResponseEnabled) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Active';
        } else {
            statusDot.className = 'status-dot inactive';
            statusText.textContent = 'Paused';
        }
    } else {
        statusDot.className = 'status-dot inactive';
        statusText.textContent = 'Not on OmniChat';
    }
}

function updateQueue() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        // Send a custom message to get queue data
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getQueue'}, function(response) {
            if (response && response.success) {
                displayQueue(response.queue);
            }
        });
    });
}

function displayQueue(queue) {
    const container = document.getElementById('queueList');
    
    if (!queue || queue.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-message">No appeals in queue</div>
            </div>
        `;
        return;
    }
    
    const html = queue.map((item, index) => {
        const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
        const status = index === 0 ? 'processing' : 'pending';
        
        return `
            <div class="queue-item">
                <div class="queue-item-info">
                    <div class="queue-item-id">Appeal #${item.appealId}</div>
                    <div class="queue-item-time">Added: ${time}</div>
                </div>
                <div class="queue-item-status ${status}">${status}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function updateRecentActivity() {
    chrome.storage.local.get(['recentActivity'], function(result) {
        const activity = result.recentActivity || [];
        displayRecentActivity(activity.slice(-5).reverse());
    });
}

function displayRecentActivity(activity) {
    const container = document.getElementById('recentActivity');
    
    if (!activity || activity.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🕐</div>
                <div class="empty-message">No recent activity</div>
            </div>
        `;
        return;
    }
    
    const html = activity.map(item => {
        const time = new Date(item.timestamp).toLocaleTimeString('ru-RU');
        const statusClass = item.success ? 'completed' : 'failed';
        const statusText = item.success ? 'Completed' : 'Failed';
        
        return `
            <div class="queue-item">
                <div class="queue-item-info">
                    <div class="queue-item-id">Appeal #${item.appealId}</div>
                    <div class="queue-item-time">${time} - ${item.action || 'Processed'}</div>
                </div>
                <div class="queue-item-status ${statusClass}">${statusText}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Control Functions
function testAutoResponse() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        addLog('info', 'Testing auto-response system...');
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'testAutoResponse'}, function(response) {
            if (response && response.success) {
                showNotification('Test initiated', 'info');
                addLog('success', 'Test completed successfully');
            } else {
                showNotification('Test failed', 'error');
                addLog('error', 'Test failed: ' + (response?.error || 'Unknown error'));
            }
        });
    });
}

function checkAppeals() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        addLog('info', 'Checking for new appeals...');
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'checkAppeals'}, function(response) {
            if (response && response.success) {
                const count = response.count || 0;
                showNotification(`Found ${count} appeals`, 'info');
                addLog('success', `Found ${count} new appeals`);
                refreshDashboard();
            }
        });
    });
}

function processManualAppeal() {
    const appealId = document.getElementById('manualAppealId').value.trim();
    
    if (!appealId) {
        showNotification('Please enter an Appeal ID', 'error');
        return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        addLog('info', `Manually processing appeal: ${appealId}`);
        
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'processManual',
            appealId: appealId
        }, function(response) {
            if (response && response.success) {
                showNotification('Appeal added to queue', 'success');
                addLog('success', `Appeal ${appealId} added to processing queue`);
                document.getElementById('manualAppealId').value = '';
                refreshDashboard();
            } else {
                showNotification('Failed to process appeal', 'error');
                addLog('error', `Failed to process appeal ${appealId}`);
            }
        });
    });
}

function clearQueue() {
    if (!confirm('Clear all pending appeals from queue?')) return;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'clearQueue'}, function(response) {
            if (response && response.success) {
                showNotification('Queue cleared', 'success');
                addLog('info', 'Queue cleared');
                refreshDashboard();
            }
        });
    });
}

function clearAllData() {
    if (!confirm('This will reset all data and settings. Continue?')) return;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'clearData'}, function(response) {
            if (response && response.success) {
                showNotification('All data cleared', 'success');
                addLog('warning', 'All data has been reset');
                refreshDashboard();
            }
        });
    });
}

// Logs Functions
function refreshLogs() {
    displayLogs();
}

function addLog(type, message) {
    const log = {
        type: type,
        message: message,
        timestamp: Date.now()
    };
    
    logs.unshift(log);
    if (logs.length > 100) logs.pop();
    
    // Update badge
    const logsBadge = document.getElementById('logsBadge');
    if (type === 'error' || type === 'warning') {
        const count = parseInt(logsBadge.textContent || 0) + 1;
        logsBadge.textContent = count;
        logsBadge.style.display = 'inline-block';
    }
    
    // Save to storage
    chrome.storage.local.set({ logs: logs });
    
    // Update display if on logs tab
    if (currentTab === 'logs') {
        displayLogs();
    }
}

function displayLogs(filter = 'all') {
    const container = document.getElementById('logsList');
    const filteredLogs = filter === 'all' ? logs : logs.filter(log => log.type === filter);
    
    if (filteredLogs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📜</div>
                <div class="empty-message">No logs available</div>
            </div>
        `;
        return;
    }
    
    const html = filteredLogs.map(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('ru-RU');
        return `
            <div class="log-entry ${log.type}">
                <div class="log-time">${time}</div>
                <div class="log-message">${log.message}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function clearLogs() {
    logs = [];
    chrome.storage.local.remove(['logs']);
    document.getElementById('logsBadge').style.display = 'none';
    displayLogs();
    showNotification('Logs cleared', 'info');
}

// Config Functions
function loadConfig() {
    chrome.storage.local.get(['templateConfig'], function(result) {
        config = result.templateConfig || {
            templateText: 'Запрос принят в работу',
            responseDelay: 2000,
            clickDelay: 500,
            maxRetries: 3
        };
        
        // Update UI
        document.getElementById('templateText').value = config.templateText;
        document.getElementById('responseDelay').value = config.responseDelay;
        document.getElementById('clickDelay').value = config.clickDelay;
        document.getElementById('maxRetries').value = config.maxRetries;
        
        updateSliderValues();
    });
}

function saveConfig() {
    config = {
        templateText: document.getElementById('templateText').value,
        responseDelay: parseInt(document.getElementById('responseDelay').value),
        clickDelay: parseInt(document.getElementById('clickDelay').value),
        maxRetries: parseInt(document.getElementById('maxRetries').value)
    };
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs[0]) return;
        
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateTemplateConfig',
            config: config
        }, function(response) {
            if (response && response.success) {
                showNotification('Configuration saved', 'success');
                addLog('info', 'Configuration updated');
            }
        });
    });
}

// History Functions
function loadHistory() {
    chrome.storage.local.get(['processedAppeals'], function(result) {
        const history = result.processedAppeals || [];
        displayHistory(history.slice(-20).reverse());
    });
}

function displayHistory(history) {
    const container = document.getElementById('historyList');
    
    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <div class="empty-message">No processing history</div>
            </div>
        `;
        return;
    }
    
    const html = history.map(item => {
        const date = new Date(item.timestamp);
        const time = date.toLocaleTimeString('ru-RU');
        const dateStr = date.toLocaleDateString('ru-RU');
        
        return `
            <div class="history-item">
                <div class="history-header">
                    <div class="history-id">Appeal #${item.appealId}</div>
                    <div class="history-time">${dateStr} ${time}</div>
                </div>
                <div class="history-details">
                    <div class="history-detail">
                        <span>✅</span> Processed
                    </div>
                    ${item.responseTime ? `
                        <div class="history-detail">
                            <span>⏱️</span> ${item.responseTime}ms
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function clearHistory() {
    if (!confirm('Clear all processing history?')) return;
    
    chrome.storage.local.remove(['processedAppeals']);
    loadHistory();
    showNotification('History cleared', 'info');
}

// Event Listeners
function setupEventListeners() {
    // Auto Response Toggle
    document.getElementById('autoResponseToggle').addEventListener('change', function(e) {
        const enabled = e.target.checked;
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) return;
            
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleAutoResponse'
            }, function(response) {
                if (response && response.success) {
                    showNotification(response.enabled ? 'Auto-response enabled' : 'Auto-response disabled', 'info');
                    addLog('info', response.enabled ? 'Auto-response enabled' : 'Auto-response disabled');
                    refreshDashboard();
                }
            });
        });
    });

    // Sliders
    document.getElementById('responseDelay').addEventListener('input', updateSliderValues);
    document.getElementById('clickDelay').addEventListener('input', updateSliderValues);
    document.getElementById('maxRetries').addEventListener('input', updateSliderValues);

    // Log Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            displayLogs(this.dataset.filter);
        });
    });
}

function updateSliderValues() {
    document.getElementById('responseDelayValue').textContent = 
        document.getElementById('responseDelay').value + 'ms';
    document.getElementById('clickDelayValue').textContent = 
        document.getElementById('clickDelay').value + 'ms';
    document.getElementById('maxRetriesValue').textContent = 
        document.getElementById('maxRetries').value;
}

// Helper Functions
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function exportData() {
    chrome.storage.local.get(null, function(data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `omnichat-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification('Data exported', 'success');
    });
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                chrome.storage.local.set(data, function() {
                    showNotification('Data imported successfully', 'success');
                    loadInitialData();
                });
            } catch (error) {
                showNotification('Invalid file format', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Auto Refresh
function startAutoRefresh() {
    autoRefreshInterval = setInterval(() => {
        if (currentTab === 'dashboard') {
            refreshDashboard();
        }
    }, 5000); // Refresh every 5 seconds
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
}

// Global functions for onclick handlers
window.refreshQueue = updateQueue;
window.testAutoResponse = testAutoResponse;
window.checkAppeals = checkAppeals;
window.clearQueue = clearQueue;
window.clearAllData = clearAllData;
window.processManualAppeal = processManualAppeal;
window.clearLogs = clearLogs;
window.saveConfig = saveConfig;
window.clearHistory = clearHistory;
window.exportData = exportData;
window.importData = importData;

// Load logs from storage on startup
chrome.storage.local.get(['logs'], function(result) {
    logs = result.logs || [];
    if (currentTab === 'logs') {
        displayLogs();
    }
});