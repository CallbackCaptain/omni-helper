// 1. Проверка наличия анализатора
console.log('🔍 Checking OmniAnalyzer...');
if (window.omniAnalyzer) {
    console.log('✅ OmniAnalyzer found!');
    console.log('📊 Current stats:', omniAnalyzer.getStats());
} else {
    console.error('❌ OmniAnalyzer not found! Make sure extension is loaded.');
}

// 2. Поиск элементов на странице
async function checkElements() {
    console.log('\n🔍 Searching for OmniChat elements...\n');
    
    const elements = {
        templateButton: document.querySelector('button[data-testid="choose-templates"]'),
        modal: document.querySelector('div[data-testid="modal"]'),
        templates: document.querySelectorAll('div[data-testid="reply-template"]'),
        messageInput: document.querySelector('textarea') || document.querySelector('[contenteditable="true"]'),
        sendButton: null
    };
    
    // Поиск кнопки отправки
    const sendSelectors = [
        'button[title*="Отправить"]',
        'button[aria-label*="Отправить"]',
        'button[type="submit"]:not([disabled])'
    ];
    
    for (const selector of sendSelectors) {
        elements.sendButton = document.querySelector(selector);
        if (elements.sendButton) break;
    }
    
    console.log('📋 Template button:', elements.templateButton ? '✅ Found' : '❌ Not found');
    console.log('📋 Modal window:', elements.modal ? '✅ Visible' : '⚠️ Not visible (will appear on button click)');
    console.log('📋 Templates:', elements.templates.length > 0 ? `✅ ${elements.templates.length} templates` : '⚠️ No templates (open modal first)');
    console.log('📋 Message input:', elements.messageInput ? '✅ Found' : '❌ Not found');
    console.log('📋 Send button:', elements.sendButton ? '✅ Found' : '❌ Not found');
    
    return elements;
}

// 3. Тест открытия модального окна шаблонов
async function testOpenModal() {
    console.log('\n🧪 Testing modal opening...\n');
    
    const button = document.querySelector('button[data-testid="choose-templates"]');
    if (!button) {
        console.error('❌ Template button not found!');
        return false;
    }
    
    console.log('👆 Clicking template button...');
    button.click();
    
    // Ждем появления модального окна
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const modal = document.querySelector('div[data-testid="modal"]');
    const templates = document.querySelectorAll('div[data-testid="reply-template"]');
    
    if (modal && templates.length > 0) {
        console.log('✅ Modal opened successfully!');
        console.log(`📋 Found ${templates.length} templates`);
        
        // Выводим первые 3 шаблона
        console.log('\n📝 First templates:');
        for (let i = 0; i < Math.min(3, templates.length); i++) {
            const title = templates[i].querySelector('span[data-testid="reply-title"]')?.textContent;
            const text = templates[i].querySelector('div[data-testid="collapsable-text"]')?.textContent;
            console.log(`  ${i + 1}. ${title}`);
            console.log(`     Text: ${text?.substring(0, 60)}...`);
        }
        
        return true;
    } else {
        console.error('❌ Failed to open modal or no templates found');
        return false;
    }
}

// 4. Тест выбора шаблона
async function testSelectTemplate() {
    console.log('\n🧪 Testing template selection...\n');
    
    // Сначала открываем модальное окно
    const modalOpened = await testOpenModal();
    if (!modalOpened) return false;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ищем первый шаблон с текстом "Запрос принят в работу"
    const templates = document.querySelectorAll('div[data-testid="reply-template"]');
    let targetTemplate = null;
    
    for (const template of templates) {
        const text = template.querySelector('div[data-testid="collapsable-text"]')?.textContent;
        if (text && text.includes('Запрос принят в работу')) {
            targetTemplate = template;
            console.log('✅ Found target template with text: "Запрос принят в работу"');
            break;
        }
    }
    
    if (!targetTemplate && templates.length > 0) {
        targetTemplate = templates[0];
        console.log('⚠️ Target text not found, using first template');
    }
    
    if (targetTemplate) {
        const title = targetTemplate.querySelector('span[data-testid="reply-title"]')?.textContent;
        console.log(`👆 Clicking template: ${title}`);
        
        targetTemplate.click();
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Проверяем, вставился ли текст
        const messageInput = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
        if (messageInput) {
            const currentText = messageInput.value || messageInput.textContent || messageInput.innerText;
            if (currentText) {
                console.log('✅ Template text inserted!');
                console.log(`📝 Text: ${currentText.substring(0, 100)}...`);
                return true;
            }
        }
    }
    
    console.error('❌ Failed to select template');
    return false;
}

// 5. Полный тест цикла (без реальной отправки)
async function testFullCycle(sendMessage = false) {
    console.log('\n🔄 Testing full auto-response cycle...\n');
    console.log('⚠️ Send message:', sendMessage ? 'YES' : 'NO (dry run)');
    
    try {
        // Шаг 1: Проверка элементов
        console.log('Step 1: Checking elements...');
        const elements = await checkElements();
        
        // Шаг 2: Открытие модального окна
        console.log('\nStep 2: Opening template modal...');
        const button = elements.templateButton || document.querySelector('button[data-testid="choose-templates"]');
        if (!button) throw new Error('Template button not found');
        
        button.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Шаг 3: Выбор шаблона
        console.log('\nStep 3: Selecting template...');
        const templates = document.querySelectorAll('div[data-testid="reply-template"]');
        if (templates.length === 0) throw new Error('No templates found');
        
        const firstTemplate = templates[0];
        const templateTitle = firstTemplate.querySelector('span[data-testid="reply-title"]')?.textContent;
        console.log(`Selecting: ${templateTitle}`);
        
        firstTemplate.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Шаг 4: Проверка текста
        console.log('\nStep 4: Checking inserted text...');
        const messageInput = document.querySelector('textarea') || document.querySelector('[contenteditable="true"]');
        const insertedText = messageInput?.value || messageInput?.textContent || messageInput?.innerText;
        
        if (insertedText) {
            console.log('✅ Text inserted:', insertedText.substring(0, 100) + '...');
        } else {
            throw new Error('No text inserted');
        }
        
        // Шаг 5: Отправка (опционально)
        if (sendMessage) {
            console.log('\nStep 5: Sending message...');
            const sendButton = document.querySelector('button[title*="Отправить"]') || 
                              document.querySelector('button[type="submit"]:not([disabled])');
            
            if (sendButton) {
                console.log('⚠️ Ready to send. Button found:', sendButton);
                console.log('👆 Clicking send button...');
                sendButton.click();
                console.log('✅ Message sent!');
            } else {
                console.log('❌ Send button not found');
            }
        } else {
            console.log('\nStep 5: Skipping send (dry run mode)');
        }
        
        console.log('\n✅ Full cycle test completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }
}

// 6. Команды для быстрого тестирования
console.log('\n📋 Available test commands:\n');
console.log('  checkElements()       - Check all page elements');
console.log('  testOpenModal()       - Test opening template modal');
console.log('  testSelectTemplate()  - Test selecting a template');
console.log('  testFullCycle(false)  - Test full cycle (dry run)');
console.log('  testFullCycle(true)   - Test full cycle with send');
console.log('\n💡 OmniAnalyzer commands:');
console.log('  omniAnalyzer.getStats()           - Get current statistics');
console.log('  omniAnalyzer.testAutoResponse()   - Test auto-response');
console.log('  omniAnalyzer.findTemplateElements() - Find template elements');
console.log('  omniAnalyzer.testFullCycle()      - Test via extension');
console.log('  omniAnalyzer.help()               - Show all commands');

// Автоматически проверяем элементы
checkElements();