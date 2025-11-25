// Background service worker for OmniChat Traffic Analyzer

chrome.runtime.onInstalled.addListener(function(details) {
    console.log('🚀 OmniChat Traffic Analyzer installed:', details.reason);
    
    if (details.reason === 'install') {
        // First installation
        chrome.storage.local.set({
            installDate: Date.now(),
            version: chrome.runtime.getManifest().version,
            autoResponseEnabled: true,
            dialogIds: [],
            networkLog: []
        }, function() {
            console.log('✅ Initial settings saved');
        });
        
        // Extension installed - ready to work on OmniChat pages
        console.log('✅ Extension ready. Navigate to OmniChat to start analyzing.');
    } else if (details.reason === 'update') {
        console.log('🔄 Extension updated from version', details.previousVersion);
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(function(tab) {
    console.log('🖱️ Extension icon clicked on tab:', tab.url);
});

// Message relay between content scripts and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('📨 Background received message:', request.action);
    
    if (request.action === 'newDialogId') {
        // Notify all tabs about new dialogId
        chrome.tabs.query({}, function(tabs) {
            tabs.forEach(tab => {
                if (tab.id !== sender.tab?.id) {
                    chrome.tabs.sendMessage(tab.id, request).catch(() => {});
                }
            });
        });
        
        // Show badge with count
        chrome.storage.local.get(['dialogIds'], function(result) {
            const count = result.dialogIds ? result.dialogIds.length : 1;
            chrome.action.setBadgeText({ text: count.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
        });
    }
    
    return true;
});

// Monitor tab updates for OmniChat
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('omnichat.rt.ru')) {
            console.log('✅ OmniChat page loaded, analyzer should be active');
            
            // Update badge
            chrome.action.setBadgeText({ text: '●', tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#28a745', tabId: tabId });
        }
    }
});

// Clear badge when tab is closed
chrome.tabs.onRemoved.addListener(function(tabId) {
    chrome.action.setBadgeText({ text: '', tabId: tabId });
});

console.log('✅ Background service worker initialized');