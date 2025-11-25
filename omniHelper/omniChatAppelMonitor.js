class AppealMonitor {
    constructor() {
        this.appeals = new Map();
        this.isMonitoring = false;
        this.checkInterval = null;
        
        console.log('📊 Appeal Monitor initialized');
    }
    
    // Запуск мониторинга
    start() {
        if (this.isMonitoring) {
            console.log('⚠️ Monitor already running');
            return;
        }
        
        this.isMonitoring = true;
        console.log('🟢 Monitor started');
        
        // Первая проверка
        this.checkForAppeals();
        
        // Проверка каждые 10 секунд (уменьшаем частоту)
        this.checkInterval = setInterval(() => {
            this.checkForAppeals();
        }, 10000);
        
        // Также слушаем сетевые запросы
        this.interceptNetwork();
    }
    
    // Остановка мониторинга
    stop() {
        if (!this.isMonitoring) {
            console.log('⚠️ Monitor not running');
            return;
        }
        
        this.isMonitoring = false;
        clearInterval(this.checkInterval);
        console.log('🔴 Monitor stopped');
    }
    
    // Поиск обращений в левом боковом меню
    findAppealsInSidebar() {
        // Специфичные селекторы для реальной структуры OmniChat
        const specificSelectors = [
            // Основные селекторы для обращений
            '[data-testid="appeal-preview"]',
            '#scroll-box-root [data-testid="appeal-preview"]',
            '.sc-dUHDFv.diHQGp',
            
            // Дополнительные селекторы
            '#scroll-box-root > div',
            '.sc-iLXxbI.hFnklZ [data-testid="appeal-preview"]',
        ];

        let sidebarAppeals = [];
        
        // Сначала пробуем точные селекторы
        for (const selector of specificSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
                    sidebarAppeals.push(...Array.from(elements));
                }
            } catch (e) {
                console.log(`⚠️ Error with selector ${selector}:`, e.message);
            }
        }
        
        // Если не нашли точные элементы, используем общий поиск
        if (sidebarAppeals.length === 0) {
            console.log('🔍 Using fallback search...');
            
            const fallbackSelectors = [
                // Поиск по контейнеру
                '#scroll-box-root div[class*="sc-"]',
                '[class*="hFnklZ"] > div',
                '[class*="diHQGp"]',
                // Общие селекторы для боковых меню
                '.sidebar [class*="appeal"]',
                '.left-panel [class*="chat"]',
                '[role="listitem"]'
            ];
            
            for (const selector of fallbackSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    const validElements = Array.from(elements).filter(element => {
                        const rect = element.getBoundingClientRect();
                        const style = window.getComputedStyle(element);
                        
                        // Проверяем, что элемент видим и находится в разумных границах
                        return rect.width > 50 && 
                               rect.height > 50 && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               rect.left < window.innerWidth * 0.5; // Левая половина экрана
                    });
                    
                    if (validElements.length > 0) {
                        console.log(`📋 Fallback found ${validElements.length} elements with: ${selector}`);
                        sidebarAppeals.push(...validElements);
                        break; // Используем первый успешный результат
                    }
                } catch (e) {
                    // Игнорируем ошибки
                }
            }
        }
        
        // Убираем дубликаты и ограничиваем максимум 3 обращения
        sidebarAppeals = [...new Set(sidebarAppeals)].slice(0, 3);
        
        console.log(`📋 Final result: Found ${sidebarAppeals.length} appeals in sidebar`);
        
        // Логируем информацию о найденных элементах
        sidebarAppeals.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            const testId = element.getAttribute('data-testid');
            const className = element.className;
            console.log(`  ${index + 1}. Element: testid="${testId}" class="${className.substring(0, 50)}..." size=${rect.width}x${rect.height}`);
        });
        
        return sidebarAppeals;
    }

    // Поиск обращений на странице
    checkForAppeals() {
        // Сначала ищем в боковом меню
        const sidebarAppeals = this.findAppealsInSidebar();
        
        // Затем обычный поиск по всей странице
        const selectors = [
            '[data-appeal-id]',
            '[data-appealid]',
            '.appeal-item',
            '.chat-item',
            '.dialog-item',
            '.conversation-item',
            // Специфичные для чатов
            '.chat-list-item',
            '.message-list-item',
            '[role="listitem"]',
            // По классам
            '[class*="appeal"]',
            '[class*="chat-item"]',
            '[class*="dialog"]'
        ];
        
        let foundElements = [...sidebarAppeals]; // Начинаем с элементов из бокового меню
        
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                foundElements.push(...elements);
            }
        }
        
        // Убираем дубликаты
        foundElements = [...new Set(foundElements)];
        
        // Анализируем каждый элемент
        foundElements.forEach(element => {
            const appealInfo = this.extractAppealInfo(element);
            if (appealInfo && appealInfo.id) {
                // Отмечаем, если обращение из бокового меню
                appealInfo.fromSidebar = sidebarAppeals.includes(element);
                
                if (!this.appeals.has(appealInfo.id)) {
                    // Новое обращение!
                    this.appeals.set(appealInfo.id, appealInfo);
                    console.log('🆕 New appeal detected:', appealInfo.id, 'Status:', appealInfo.status);
                    // Ограничиваем вызов onNewAppeal только для новых обращений
                    if (appealInfo.status === 'new') {
                        this.onNewAppeal(appealInfo);
                        
                        // Уведомляем OmniAnalyzer о наличии нового обращения
                        // Но НЕ добавляем его напрямую в очередь
                        if (window.omniAnalyzer) {
                            console.log('📣 AppealMonitor: Notifying OmniAnalyzer about new appeal');
                            // Можно тригернуть проверку через короткое время
                            setTimeout(() => {
                                if (window.omniAnalyzer && window.omniAnalyzer.autoResponseEnabled) {
                                    console.log('🔍 Triggering OmniAnalyzer appeal check...');
                                    window.omniAnalyzer.checkForExistingAppeals();
                                }
                            }, 1000);
                        }
                    }
                } else {
                    // Обновляем информацию
                    const existing = this.appeals.get(appealInfo.id);
                    if (existing.status !== appealInfo.status) {
                        console.log('🔄 Appeal status changed:', appealInfo.id, existing.status, '->', appealInfo.status);
                    }
                    this.appeals.set(appealInfo.id, appealInfo);
                }
            }
        });
        
        if (foundElements.length === 0 && this.appeals.size === 0) {
            console.log('👀 No appeals found on page');
        }
    }
    
    // Извлечение информации об обращении
    extractAppealInfo(element) {
        const info = {
            id: null,
            name: null,
            text: null,
            status: 'unknown',
            timestamp: Date.now(),
            element: element
        };
        
        // Для элементов с data-testid="appeal-preview"
        if (element.getAttribute('data-testid') === 'appeal-preview') {
            // Извлекаем имя клиента
            const nameElement = element.querySelector('.sc-hSWyVn.jLoqEI, [title]');
            if (nameElement) {
                info.name = nameElement.textContent?.trim() || nameElement.getAttribute('title');
                // Используем имя как ID, если нет другого ID
                info.id = info.name?.replace(/\s+/g, '_') || `appeal_${Date.now()}`;
            }
            
            // Извлекаем последнее сообщение
            const messageElement = element.querySelector('.sc-mYtaj.hfzSXm');
            if (messageElement) {
                info.text = messageElement.textContent?.trim();
            }
            
            // Проверяем наличие бейджа (новое сообщение)
            const badge = element.querySelector('[data-testid="badge"], [data-testid="dot"]');
            if (badge) {
                info.status = 'new';
            } else {
                info.status = 'read';
            }
        } else {
            // Старая логика для других элементов
            // 1. Из data-атрибутов
            info.id = element.dataset?.appealId || 
                     element.dataset?.appealid || 
                     element.getAttribute('data-appeal-id') ||
                     element.getAttribute('data-dialog-id');
            
            // 2. Из текста элемента
            if (!info.id) {
                const text = element.textContent || '';
                
                // Паттерны для поиска ID
                const patterns = [
                    /#(\d{5,})/,           // #12345678
                    /Appeal[:\s]+(\d+)/i,  // Appeal: 12345678
                    /ID[:\s]+(\d+)/i,      // ID: 12345678
                    /№(\d{5,})/,           // №12345678
                    /Обращение[:\s]+(\d+)/i // Обращение: 12345678
                ];
                
                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match) {
                        info.id = match[1];
                        break;
                    }
                }
            }
            
            // 3. Из ID элемента
            if (!info.id && element.id) {
                const idMatch = element.id.match(/\d{5,}/);
                if (idMatch) {
                    info.id = idMatch[0];
                }
            }
            
            // Извлекаем текст сообщения
            info.text = element.textContent?.trim().substring(0, 100);
            
            // Определяем статус (новый/прочитанный)
            const isNew = this.isNewAppeal(element);
            info.status = isNew ? 'new' : 'read';
        }
        
        // Если ID не найден, создаем на основе текста или времени
        if (!info.id) {
            info.id = info.text?.substring(0, 20).replace(/\W+/g, '_') || `appeal_${Date.now()}`;
        }
        
        return info;
    }
    
    // Проверка, является ли обращение новым или активным
    isNewAppeal(element) {
        // Проверяем различные индикаторы нового сообщения
        
        // 1. Классы
        const classList = element.className || '';
        if (classList.includes('unread') || 
            classList.includes('new') || 
            classList.includes('pending') ||
            classList.includes('active')) {
            return true;
        }
        
        // 2. Индикаторы непрочитанного
        const unreadIndicators = [
            '.badge',
            '.notification',
            '.unread-indicator',
            '[data-unread="true"]',
            '[data-status="new"]',
            '.new-message'
        ];
        
        for (const selector of unreadIndicators) {
            if (element.querySelector(selector)) {
                return true;
            }
        }
        
        // 3. Стиль текста (жирный часто означает непрочитанное)
        const fontWeight = window.getComputedStyle(element).fontWeight;
        if (fontWeight === 'bold' || parseInt(fontWeight) >= 600) {
            return true;
        }
        
        // 4. Фоновый цвет (новые часто выделены)
        const bgColor = window.getComputedStyle(element).backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            // Есть фоновый цвет - возможно, выделение
            return true;
        }
        
        return false;
    }

    // Определение активного обращения
    findActiveAppeal() {
        // Сначала ищем среди элементов бокового меню
        const sidebarAppeals = this.findAppealsInSidebar();
        console.log(`🔍 Checking ${sidebarAppeals.length} sidebar appeals for active state`);
        
        for (const element of sidebarAppeals) {
            const classList = element.className || '';
            const style = window.getComputedStyle(element);
            
            // Проверяем наличие бейджа (индикатор нового сообщения)
            const badge = element.querySelector('[data-testid="badge"], [data-testid="dot"]');
            if (badge) {
                console.log('✅ Found active appeal with badge (new message)');
                return element;
            }
            
            // Проверяем классы активности
            if (classList.includes('active') || 
                classList.includes('selected') || 
                classList.includes('current') ||
                classList.includes('focused')) {
                console.log('✅ Found active appeal with active class');
                return element;
            }
            
            // Проверяем атрибуты
            if (element.getAttribute('data-active') === 'true' ||
                element.getAttribute('data-selected') === 'true' ||
                element.getAttribute('aria-selected') === 'true') {
                console.log('✅ Found active appeal with active attribute');
                return element;
            }
            
            // Проверяем стили (выделенный фон, рамка)
            const bgColor = style.backgroundColor;
            const borderColor = style.borderColor;
            const borderWidth = parseInt(style.borderWidth) || 0;
            
            // Проверяем, есть ли выделение цветом
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                // Проверяем, что это не базовый белый фон
                if (!bgColor.includes('255, 255, 255') && !bgColor.includes('rgb(255, 255, 255)')) {
                    console.log('✅ Found active appeal with colored background:', bgColor);
                    return element;
                }
            }
            
            if (borderWidth > 1 && borderColor !== 'rgba(0, 0, 0, 0)') {
                console.log('✅ Found active appeal with border');
                return element;
            }
        }
        
        // Если не нашли активное по признакам, берем первое с бейджем
        for (const element of sidebarAppeals) {
            const badge = element.querySelector('[data-testid="badge"], [data-testid="dot"]');
            if (badge) {
                console.log('⚠️ Using first appeal with badge as active');
                return element;
            }
        }
        
        // Если не нашли с бейджем, берем первое
        if (sidebarAppeals.length > 0) {
            console.log('⚠️ Using first appeal as active (no clear active indicators)');
            return sidebarAppeals[0];
        }
        
        console.log('❌ No active appeal found');
        return null;
    }

    // Выбор активного обращения (клик по элементу)
    selectActiveAppeal() {
        const activeElement = this.findActiveAppeal();
        
        if (!activeElement) {
            console.log('⚠️ No active appeal found to select');
            return null;
        }
        
        // Получаем информацию об обращении
        const appealInfo = this.extractAppealInfo(activeElement);
        
        if (!appealInfo || !appealInfo.id) {
            console.log('⚠️ Could not extract appeal info from active element');
            return null;
        }
        
        console.log('👆 Clicking on active appeal:', appealInfo.id);
        
        // Кликаем по элементу для его активации
        try {
            activeElement.click();
            
            // Ждем немного, чтобы интерфейс обновился
            setTimeout(() => {
                console.log('✅ Appeal selected:', appealInfo.id);
            }, 500);
            
            return appealInfo;
        } catch (error) {
            console.error('❌ Error clicking on appeal:', error);
            return null;
        }
    }

    // Получение списка всех обращений из бокового меню
    getSidebarAppeals() {
        const sidebarElements = this.findAppealsInSidebar();
        const appeals = [];
        
        sidebarElements.forEach(element => {
            const appealInfo = this.extractAppealInfo(element);
            if (appealInfo && appealInfo.id) {
                appealInfo.isActive = this.findActiveAppeal() === element;
                appeals.push(appealInfo);
            }
        });
        
        return appeals.slice(0, 3); // Максимум 3 обращения
    }
    
    // Обработчик нового обращения
    onNewAppeal(appealInfo) {
        console.log('🎉 NEW APPEAL DETECTED!');
        console.log('  ID:', appealInfo.id);
        console.log('  Status:', appealInfo.status);
        console.log('  Text preview:', appealInfo.text);
        
        // ОТКЛЮЧЕНО: ПРЕДОТВРАЩЕНИЕ ДУБЛИРОВАНИЯ
        // AppealMonitor теперь только обнаруживает обращения
        // Обработка происходит только через OmniAnalyzer.checkForExistingAppeals()
        
        if (window.omniAnalyzer) {
            console.log('📝 AppealMonitor: New appeal detected, but NOT adding to queue to prevent duplication');
            console.log('    OmniAnalyzer will pick it up during periodic check');
            console.log('    Appeal ID:', appealInfo.id, 'Status:', appealInfo.status);
        } else {
            console.log('⚠️ OmniAnalyzer not available, appeal detection only');
        }
        
        // Визуальное выделение элемента
        if (appealInfo.element) {
            appealInfo.element.style.border = '2px solid #4CAF50';
            appealInfo.element.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
            
            // Убираем выделение через 3 секунды
            setTimeout(() => {
                appealInfo.element.style.border = '';
                appealInfo.element.style.boxShadow = '';
            }, 3000);
        }
    }

    // Автоматическая отправка шаблона для активного обращения
    async sendTemplateToActiveAppeal(templateKeyword = 'Запрос принят в работу', sendMessage = true) {
        console.log('🚀 Starting automatic template sending for active appeal...');
        
        try {
            // Шаг 1: Найти и выбрать активное обращение
            console.log('Step 1: Finding and selecting active appeal...');
            const selectedAppeal = this.selectActiveAppeal();
            
            if (!selectedAppeal) {
                throw new Error('No active appeal found to process');
            }
            
            console.log(`✅ Active appeal selected: ${selectedAppeal.id}`);
            
            // Ждем, чтобы интерфейс загрузился после выбора обращения
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Шаг 2: Открыть модальное окно шаблонов
            console.log('Step 2: Opening template modal...');
            
            // Расширенный поиск кнопки шаблонов
            const templateButtonSelectors = [
                'button[data-testid="choose-templates"]',
                'button[title*="шаблон"]',
                'button[title*="Шаблон"]',
                'button[title*="template"]',
                'button[title="Выбрать шаблон"]',
                'button[aria-label*="шаблон"]',
                // Поиск по содержимому
                'button:has(span:contains("Шаблон"))',
                'button:has(span:contains("шаблон"))',
                // По визуальным признакам (среди кнопок отправки)
                '.message-input-container button:not([disabled])',
                '.input-container button:not([disabled])',
                '.chat-input button:not([disabled])'
            ];
            
            let templateButton = null;
            
            for (const selector of templateButtonSelectors) {
                try {
                    templateButton = document.querySelector(selector);
                    if (templateButton) {
                        console.log('✅ Template button found with selector:', selector);
                        break;
                    }
                } catch (e) {
                    // Некорректный селектор
                }
            }
            
            // Если не нашли по селекторам, ищем по тексту
            if (!templateButton) {
                console.log('⚠️ Searching template button by text...');
                const allButtons = document.querySelectorAll('button:not([disabled])');
                
                for (const button of allButtons) {
                    const buttonText = button.textContent?.toLowerCase() || '';
                    const title = button.title?.toLowerCase() || '';
                    
                    if (buttonText.includes('шаблон') || 
                        title.includes('шаблон') ||
                        buttonText.includes('template') ||
                        title.includes('template')) {
                        templateButton = button;
                        console.log('✅ Template button found by text:', buttonText || title);
                        break;
                    }
                }
            }
            
            if (!templateButton) {
                // Последняя попытка - логируем все доступные кнопки
                console.log('⚠️ Template button not found. Available buttons:');
                const allButtons = document.querySelectorAll('button');
                allButtons.forEach((btn, index) => {
                    if (index < 10) { // Показываем первые 10
                        console.log(`  ${index + 1}. "${btn.textContent?.trim()}" title="${btn.title}" testid="${btn.getAttribute('data-testid')}"`);
                    }
                });
                throw new Error('Template button not found after extensive search');
            }
            
            templateButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Шаг 3: Найти и выбрать нужный шаблон
            console.log('Step 3: Selecting template...');
            const templates = document.querySelectorAll('div[data-testid="reply-template"]');
            if (templates.length === 0) {
                throw new Error('No templates found in modal');
            }
            
            let targetTemplate = null;
            
            // Поиск шаблона по ключевому слову
            for (const template of templates) {
                const text = template.querySelector('div[data-testid="collapsable-text"]')?.textContent;
                if (text && text.includes(templateKeyword)) {
                    targetTemplate = template;
                    break;
                }
            }
            
            // Если не найден по ключевому слову, берем первый
            if (!targetTemplate) {
                targetTemplate = templates[0];
                console.log('⚠️ Template with keyword not found, using first template');
            }
            
            const templateTitle = targetTemplate.querySelector('span[data-testid="reply-title"]')?.textContent;
            console.log(`👆 Selecting template: ${templateTitle}`);
            
            targetTemplate.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Шаг 4: Проверить, что текст вставлен
            console.log('Step 4: Checking inserted text...');
            const messageInput = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
            const insertedText = messageInput?.value || messageInput?.textContent || messageInput?.innerText;
            
            if (!insertedText) {
                throw new Error('Template text was not inserted');
            }
            
            console.log('✅ Template text inserted:', insertedText.substring(0, 100) + '...');
            
            // Шаг 5: Отправить сообщение (если требуется)
            if (sendMessage) {
                console.log('Step 5: Sending message...');
                const sendButton = document.querySelector('button[title*="Отправить"]') || 
                                  document.querySelector('button[type="submit"]:not([disabled])');
                
                if (sendButton) {
                    console.log('👆 Clicking send button...');
                    sendButton.click();
                    console.log('✅ Message sent successfully!');
                } else {
                    console.log('❌ Send button not found, message not sent');
                }
            } else {
                console.log('Step 5: Skipping send (dry run mode)');
            }
            
            console.log(`\n🎉 Template successfully sent to appeal ${selectedAppeal.id}!`);
            return {
                success: true,
                appealId: selectedAppeal.id,
                templateTitle: templateTitle,
                messageSent: sendMessage
            };
            
        } catch (error) {
            console.error('❌ Error sending template:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Быстрая отправка шаблона без подтверждения
    async quickSendTemplate() {
        return await this.sendTemplateToActiveAppeal('Запрос принят в работу', true);
    }

    // Тестовая отправка (без реальной отправки)
    async testSendTemplate() {
        return await this.sendTemplateToActiveAppeal('Запрос принят в работу', false);
    }

    // Диагностическая информация о боковом меню
    diagnoseAppeals() {
        console.log('\n🔍 APPEAL DIAGNOSIS REPORT\n');
        
        // Проверяем основные контейнеры
        const scrollBoxRoot = document.querySelector('#scroll-box-root');
        console.log('📦 Container #scroll-box-root:', scrollBoxRoot ? '✅ Found' : '❌ Not found');
        
        if (scrollBoxRoot) {
            const children = scrollBoxRoot.children;
            console.log(`📋 Children in container: ${children.length}`);
            
            for (let i = 0; i < Math.min(children.length, 5); i++) {
                const child = children[i];
                const testId = child.getAttribute('data-testid');
                const className = child.className;
                console.log(`  ${i + 1}. testid="${testId}" class="${className.substring(0, 30)}..."`);
            }
        }
        
        // Ищем appeal-preview элементы
        const appealPreviews = document.querySelectorAll('[data-testid="appeal-preview"]');
        console.log(`\n📬 Appeal previews found: ${appealPreviews.length}`);
        
        appealPreviews.forEach((element, index) => {
            const info = this.extractAppealInfo(element);
            const rect = element.getBoundingClientRect();
            
            console.log(`  Appeal ${index + 1}:`);
            console.log(`    Name: ${info.name}`);
            console.log(`    Text: ${info.text?.substring(0, 50)}...`);
            console.log(`    Status: ${info.status}`);
            console.log(`    Size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
            console.log(`    Position: ${Math.round(rect.left)}, ${Math.round(rect.top)}`);
            
            // Проверяем наличие бейджа
            const badge = element.querySelector('[data-testid="badge"], [data-testid="dot"]');
            console.log(`    Badge: ${badge ? '✅ Has badge' : '❌ No badge'}`);
        });
        
        // Ищем активное обращение
        console.log('\n🎯 Active appeal search:');
        const activeAppeal = this.findActiveAppeal();
        if (activeAppeal) {
            const info = this.extractAppealInfo(activeAppeal);
            console.log(`✅ Active appeal: ${info.name || info.id}`);
        } else {
            console.log('❌ No active appeal found');
        }
        
        // Проверяем кнопку шаблонов
        const templateButton = document.querySelector('button[data-testid="choose-templates"]');
        console.log(`\n📋 Template button: ${templateButton ? '✅ Found' : '❌ Not found'}`);
        
        return {
            containerFound: !!scrollBoxRoot,
            appealsCount: appealPreviews.length,
            activeAppeal: activeAppeal ? this.extractAppealInfo(activeAppeal) : null,
            templateButton: !!templateButton
        };
    }
    
    // Перехват сетевых запросов
    interceptNetwork() {
        console.log('🌐 Starting network interception...');
        
        // Перехват fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [url] = args;
            
            // Проверяем URL на наличие appealId
            if (url && url.includes('appealId=')) {
                const match = url.match(/appealId=(\d+)/);
                if (match) {
                    const appealId = match[1];
                    console.log('📡 Network: Found appealId in request:', appealId);
                    
                    if (!this.appeals.has(appealId)) {
                        this.appeals.set(appealId, {
                            id: appealId,
                            source: 'network',
                            status: 'new',
                            timestamp: Date.now()
                        });
                        
                        console.log('🆕 New appeal from network:', appealId);
                    }
                }
            }
            
            return originalFetch.apply(window, args);
        };
    }
    
    // Статистика
    getStats() {
        const stats = {
            total: this.appeals.size,
            new: 0,
            read: 0,
            unknown: 0
        };
        
        this.appeals.forEach(appeal => {
            stats[appeal.status]++;
        });
        
        return stats;
    }
    
    // Список всех обращений
    listAppeals() {
        console.log('📋 All detected appeals:');
        this.appeals.forEach((appeal, id) => {
            console.log(`  ${id}: ${appeal.status} (${new Date(appeal.timestamp).toLocaleTimeString()})`);
        });
        
        return Array.from(this.appeals.values());
    }
    
    // Очистка
    clear() {
        this.appeals.clear();
        console.log('🧹 Appeals cleared');
    }
}

// Создаем глобальный экземпляр монитора
window.appealMonitor = new AppealMonitor();

console.log('\n📊 APPEAL MONITOR READY (MANUAL MODE)\n');
console.log('Basic Commands:');
console.log('  appealMonitor.start()                - Start monitoring');
console.log('  appealMonitor.stop()                 - Stop monitoring');
console.log('  appealMonitor.getStats()             - Get statistics');
console.log('  appealMonitor.listAppeals()          - List all appeals');
console.log('  appealMonitor.clear()                - Clear all data');
console.log('  appealMonitor.checkForAppeals()      - Manual check');
console.log('\nDiagnostics:');
console.log('  appealMonitor.diagnoseAppeals()      - 🔍 DIAGNOSTIC REPORT (start here!)');
console.log('  appealMonitor.findAppealsInSidebar() - Find appeals in sidebar');
console.log('  appealMonitor.getSidebarAppeals()    - Get sidebar appeals list');
console.log('  appealMonitor.findActiveAppeal()     - Find active appeal element');
console.log('  appealMonitor.selectActiveAppeal()   - Select and click active appeal');
console.log('\nTemplate Automation:');
console.log('  appealMonitor.testSendTemplate()     - Test template sending (dry run)');
console.log('  appealMonitor.quickSendTemplate()    - Send template to active appeal');
console.log('  appealMonitor.sendTemplateToActiveAppeal(keyword, send) - Full control');
console.log('\n🚀 Quick Start:');
console.log('  1. appealMonitor.diagnoseAppeals()   - Check if appeals are detected');
console.log('  2. appealMonitor.testSendTemplate()  - Test the full process (safe)');
console.log('  3. appealMonitor.quickSendTemplate() - Send template to active appeal');
console.log('\n🔄 CONTROLLED AUTO-MONITORING ENABLED');
console.log('\n💡 New appeals will be detected and processed automatically (with spam protection)');

// КОНТРОЛИРУЕМЫЙ АВТОМАТИЧЕСКИЙ ЗАПУСК
// Без спама, но с обнаружением
setTimeout(() => {
    window.appealMonitor.start();
    console.log('✅ AppealMonitor started in controlled mode');
}, 2000);

console.log('\n🚫 Spam protection: Active (controlled processing only)');
console.log('Manual commands still available: appealMonitor.stop(), appealMonitor.quickSendTemplate()');