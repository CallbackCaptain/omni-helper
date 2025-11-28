// ===== OMNICHAT AUTO-RESPONDER v5.0 =====
// Simplified and reliable auto-response system

class OmniChatAutoResponder {
    constructor() {
        // Core state
        this.processedAppeals = new Set();
        this.appealQueue = [];
        this.isProcessing = false;
        this.autoResponseEnabled = true;
        
        // Configuration
        this.config = {
            responseDelay: 2000,
            clickDelay: 500,
            checkInterval: 2000,       // Check for new appeals every 2 seconds (optimized from 20s)
            cooldownPeriod: 2 * 60 * 60 * 1000,  // 2 hours cooldown
            templateText: 'Запрос принят в работу',
            templateTitle: '1.1 Приветствие'
        };
        
        this.init();
    }

    init() {
        console.log('🚀 OmniChat AutoResponder v5.0');
        this.loadState();
        this.injectInterceptor();
        this.setupObserver();
        this.startPeriodicCheck();
        this.exposeAPI();

        // Initial check after page load (optimized from 3000ms)
        setTimeout(() => this.checkForAppeals(), 500);
    }

    // ===== STATE MANAGEMENT =====
    
    loadState() {
        chrome.storage.local.get(['processedAppeals', 'autoResponseEnabled', 'config'], (result) => {
            if (result.autoResponseEnabled !== undefined) {
                this.autoResponseEnabled = result.autoResponseEnabled;
            }
            
            if (result.processedAppeals) {
                const now = Date.now();
                result.processedAppeals.forEach(item => {
                    // Only load appeals within cooldown period
                    if (now - item.timestamp < this.config.cooldownPeriod) {
                        this.processedAppeals.add(item.appealId);
                    }
                });
                console.log(`📥 Loaded ${this.processedAppeals.size} processed appeals`);
            }
            
            if (result.config) {
                Object.assign(this.config, result.config);
            }
        });
    }

    saveProcessedAppeal(appealId) {
        this.processedAppeals.add(appealId);
        
        chrome.storage.local.get(['processedAppeals'], (result) => {
            const processed = result.processedAppeals || [];
            
            // Add new entry
            processed.push({
                appealId: appealId,
                timestamp: Date.now()
            });
            
            // Keep only last 100 entries within cooldown
            const now = Date.now();
            const filtered = processed
                .filter(item => now - item.timestamp < this.config.cooldownPeriod)
                .slice(-100);
            
            chrome.storage.local.set({ processedAppeals: filtered });
        });
    }

    // ===== APPEAL DETECTION =====
    
    checkForAppeals() {
        if (!this.autoResponseEnabled) return;
        
        const appeals = this.findAppealsInSidebar();
        
        appeals.forEach(appeal => {
            if (this.shouldProcess(appeal.id)) {
                this.addToQueue(appeal);
            }
        });
    }

    findAppealsInSidebar() {
        const appeals = [];
        const elements = document.querySelectorAll('[data-testid="appeal-preview"]');
        
        elements.forEach(element => {
            const appealData = this.extractAppealData(element);
            if (appealData && this.isNewAppeal(element)) {
                appeals.push(appealData);
            }
        });
        
        return appeals;
    }

    extractAppealData(element) {
        // Get name as ID
        const nameEl = element.querySelector('[title], .sc-hSWyVn');
        const name = nameEl?.textContent?.trim() || nameEl?.getAttribute('title');
        
        if (!name) return null;
        
        // Create stable ID from name
        const id = name.replace(/\s+/g, '_').replace(/[^\wа-яА-Я_-]/gi, '').substring(0, 50);
        
        return {
            id: id,
            name: name,
            element: element
        };
    }

    isNewAppeal(element) {
        // Check for badge/dot indicator (new message)
        const badge = element.querySelector('[data-testid="badge"], [data-testid="dot"]');
        if (badge) return true;
        
        // Check for unread class
        const classList = element.className || '';
        if (classList.includes('unread') || classList.includes('new')) return true;
        
        return false;
    }

    shouldProcess(appealId) {
        if (!appealId) return false;
        if (this.processedAppeals.has(appealId)) return false;
        if (this.appealQueue.some(a => a.id === appealId)) return false;
        if (this.currentAppealId === appealId) return false;
        
        return true;
    }

    // ===== QUEUE MANAGEMENT =====
    
    addToQueue(appeal) {
        if (!this.shouldProcess(appeal.id)) return false;
        
        console.log('➕ Adding to queue:', appeal.id);
        this.appealQueue.push({
            ...appeal,
            addedAt: Date.now()
        });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
        
        return true;
    }

    async processQueue() {
        if (this.appealQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const appeal = this.appealQueue.shift();
        this.currentAppealId = appeal.id;
        
        console.log('⚙️ Processing:', appeal.id);
        
        try {
            await this.sendGreeting(appeal);
            this.saveProcessedAppeal(appeal.id);
            console.log('✅ Processed:', appeal.id);
        } catch (error) {
            console.error('❌ Failed:', appeal.id, error.message);
            // Mark as processed anyway to prevent spam
            this.saveProcessedAppeal(appeal.id);
        }
        
        this.currentAppealId = null;
        
        // Process next with delay
        await this.wait(this.config.responseDelay);
        this.processQueue();
    }

    // ===== AUTO-RESPONSE =====
    
    async sendGreeting(appeal) {
        // Step 1: Click on appeal to select it
        if (appeal.element && document.contains(appeal.element)) {
            appeal.element.click();
            await this.wait(this.config.clickDelay);
        }
        
        // Step 2: Open template selector
        const templateBtn = document.querySelector('button[data-testid="choose-templates"]');
        if (!templateBtn) throw new Error('Template button not found');
        
        templateBtn.click();
        await this.wait(800);
        
        // Step 3: Find and click template
        const modal = document.querySelector('div[data-testid="modal"]');
        if (!modal) throw new Error('Template modal not found');
        
        const templates = modal.querySelectorAll('div[data-testid="reply-template"]');
        let targetTemplate = this.findTargetTemplate(templates);
        
        if (!targetTemplate && templates.length > 0) {
            targetTemplate = templates[0];
        }
        
        if (!targetTemplate) throw new Error('No templates available');
        
        targetTemplate.click();
        await this.wait(800);
        
        // Step 4: Send message
        await this.clickSendButton();
    }

    findTargetTemplate(templates) {
        for (const template of templates) {
            const title = template.querySelector('span[data-testid="reply-title"]')?.textContent || '';
            const text = template.querySelector('div[data-testid="collapsable-text"]')?.textContent || '';
            
            if (title.includes(this.config.templateTitle) || 
                text.includes(this.config.templateText)) {
                return template;
            }
        }
        return null;
    }

    async clickSendButton() {
        const selectors = [
            'button[title="Отправить"]',
            'button[title*="Отправить"]',
            'button[aria-label*="Отправить"]',
            'button[data-testid="send-message"]'
        ];
        
        for (const selector of selectors) {
            const btn = document.querySelector(selector);
            if (btn && !btn.disabled) {
                btn.click();
                return;
            }
        }
        
        // Fallback: press Enter
        const input = document.querySelector('textarea, [contenteditable="true"]');
        if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
        }
    }

    // ===== OBSERVERS =====
    
    setupObserver() {
        const observer = new MutationObserver(() => {
            // Debounce checks (optimized from 1000ms)
            clearTimeout(this.checkTimeout);
            this.checkTimeout = setTimeout(() => this.checkForAppeals(), 300);
        });
        
        // Observe sidebar for new appeals
        const observeTarget = () => {
            const sidebar = document.querySelector('#scroll-box-root, .appeals-list, .chat-list');
            if (sidebar) {
                observer.observe(sidebar, { childList: true, subtree: true });
                console.log('👁️ Observing sidebar');
            } else {
                setTimeout(observeTarget, 500);  // Optimized from 2000ms
            }
        };
        
        observeTarget();
    }

    startPeriodicCheck() {
        setInterval(() => {
            if (this.autoResponseEnabled && !this.isProcessing) {
                this.checkForAppeals();
            }
        }, this.config.checkInterval);
    }

    // ===== NETWORK INTERCEPTOR =====
    
    injectInterceptor() {
        const script = document.createElement('script');
        script.textContent = `
            (function() {
                const originalFetch = window.fetch;
                window.fetch = async function(...args) {
                    const [url] = args;
                    if (url && url.includes('appealId=')) {
                        const match = url.match(/appealId=(\\d+)/);
                        if (match) {
                            window.postMessage({
                                type: 'omni-appeal-detected',
                                appealId: match[1]
                            }, '*');
                        }
                    }
                    return originalFetch.apply(this, args);
                };
            })();
        `;
        document.head.appendChild(script);
        script.remove();
        
        window.addEventListener('message', (event) => {
            if (event.data?.type === 'omni-appeal-detected') {
                setTimeout(() => this.checkForAppeals(), 300);  // Optimized from 1000ms
            }
        });
    }

    // ===== UTILITIES =====
    
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== PUBLIC API =====
    
    exposeAPI() {
        window.omniResponder = {
            // Status
            getStats: () => ({
                autoEnabled: this.autoResponseEnabled,
                queueLength: this.appealQueue.length,
                processedCount: this.processedAppeals.size,
                isProcessing: this.isProcessing
            }),
            
            // Controls
            toggle: () => {
                this.autoResponseEnabled = !this.autoResponseEnabled;
                chrome.storage.local.set({ autoResponseEnabled: this.autoResponseEnabled });
                console.log('Auto-response:', this.autoResponseEnabled ? 'ON' : 'OFF');
                return this.autoResponseEnabled;
            },
            
            enable: () => {
                this.autoResponseEnabled = true;
                chrome.storage.local.set({ autoResponseEnabled: true });
                return true;
            },
            
            disable: () => {
                this.autoResponseEnabled = false;
                chrome.storage.local.set({ autoResponseEnabled: false });
                return false;
            },
            
            // Manual actions
            check: () => {
                this.checkForAppeals();
                return 'Checking for appeals...';
            },
            
            processManual: (appealId) => {
                if (!appealId) return 'Please provide appealId';
                this.addToQueue({ id: appealId, manual: true });
                return 'Added to queue: ' + appealId;
            },
            
            clearQueue: () => {
                this.appealQueue = [];
                this.isProcessing = false;
                return 'Queue cleared';
            },
            
            clearHistory: () => {
                this.processedAppeals.clear();
                chrome.storage.local.remove(['processedAppeals']);
                return 'History cleared';
            },
            
            // Config
            getConfig: () => this.config,
            
            setConfig: (newConfig) => {
                Object.assign(this.config, newConfig);
                chrome.storage.local.set({ config: this.config });
                return 'Config updated';
            },
            
            // Debug
            findAppeals: () => this.findAppealsInSidebar(),
            
            test: async () => {
                console.log('🧪 Testing template flow...');
                const btn = document.querySelector('button[data-testid="choose-templates"]');
                if (!btn) return 'Template button not found';
                
                btn.click();
                await this.wait(1000);
                
                const templates = document.querySelectorAll('div[data-testid="reply-template"]');
                console.log(`Found ${templates.length} templates`);
                
                return `Modal opened, ${templates.length} templates found`;
            },
            
            help: () => {
                console.log(`
🤖 OmniChat AutoResponder v5.0

STATUS:
  omniResponder.getStats()     - Current status

CONTROLS:
  omniResponder.toggle()       - Toggle auto-response
  omniResponder.enable()       - Enable
  omniResponder.disable()      - Disable

ACTIONS:
  omniResponder.check()        - Check for new appeals
  omniResponder.processManual(id) - Process specific appeal
  omniResponder.clearQueue()   - Clear queue
  omniResponder.clearHistory() - Clear processed history

CONFIG:
  omniResponder.getConfig()    - Get config
  omniResponder.setConfig({})  - Update config

DEBUG:
  omniResponder.findAppeals()  - List detected appeals
  omniResponder.test()         - Test template modal
                `);
            }
        };
        
        console.log('💡 API available: omniResponder.help()');
    }
}

// ===== MESSAGE HANDLER =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const responder = window.omniResponderInstance;
    if (!responder) {
        sendResponse({ success: false, error: 'Not initialized' });
        return true;
    }
    
    switch (request.action) {
        case 'getStats':
            sendResponse({
                success: true,
                stats: {
                    autoResponseEnabled: responder.autoResponseEnabled,
                    queueLength: responder.appealQueue.length,
                    processedAppeals: responder.processedAppeals.size,
                    isProcessing: responder.isProcessing,
                    currentUrl: window.location.href
                }
            });
            break;
            
        case 'toggleAutoResponse':
            responder.autoResponseEnabled = !responder.autoResponseEnabled;
            chrome.storage.local.set({ autoResponseEnabled: responder.autoResponseEnabled });
            sendResponse({ success: true, enabled: responder.autoResponseEnabled });
            break;
            
        case 'checkAppeals':
            responder.checkForAppeals();
            sendResponse({ success: true, count: responder.appealQueue.length });
            break;
            
        case 'getQueue':
            sendResponse({
                success: true,
                queue: responder.appealQueue.map(a => ({
                    appealId: a.id,
                    timestamp: a.addedAt
                }))
            });
            break;
            
        case 'clearQueue':
            responder.appealQueue = [];
            responder.isProcessing = false;
            sendResponse({ success: true });
            break;
            
        case 'clearData':
            responder.appealQueue = [];
            responder.processedAppeals.clear();
            responder.isProcessing = false;
            chrome.storage.local.remove(['processedAppeals']);
            sendResponse({ success: true });
            break;
            
        case 'processManual':
            if (request.appealId) {
                responder.addToQueue({ id: request.appealId, manual: true });
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'No appealId' });
            }
            break;
            
        case 'updateTemplateConfig':
            Object.assign(responder.config, request.config);
            chrome.storage.local.set({ config: responder.config });
            sendResponse({ success: true });
            break;
            
        case 'testAutoResponse':
            responder.checkForAppeals();
            sendResponse({ success: true });
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true;
});

// ===== INITIALIZATION =====

window.omniResponderInstance = new OmniChatAutoResponder();

console.log(`
✅ OmniChat AutoResponder v5.0 loaded
🤖 Auto-response: ${window.omniResponderInstance.autoResponseEnabled ? 'ENABLED' : 'DISABLED'}
💡 Commands: omniResponder.help()
`);
