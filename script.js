// Add your OpenRouter API key here
const API_KEYS = {
    v1: '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',
    v2: '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',
    v3: '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',
    v4: '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'
};
let currentTheme = 'dark';
let conversations = {};
let currentConversationId = null;
let conversationContext = [];
let isGenerating = false;
let controller = null;
let recognition = null;

// Voice settings
let voiceSettings = {
    voiceType: 'auto',  // 'auto', 'male', 'female'
    voiceRate: 1.0,     // 0.5 to 2.0
    voicePitch: 1.0     // 0.5 to 2.0
};

// Model endpoints for each version
const MODEL_ENDPOINTS = {
    v1: 'openrouter/cypher-alpha:free',
    v2: 'google/gemma-3n-e4b-it:free',
    v3: 'deepseek/deepseek-chat-v3-0324:free',
    v4: 'deepseek/deepseek-r1-0528:free'
};
let currentVersion = 'v1';
let modelEndpoint = MODEL_ENDPOINTS[currentVersion];

// Load saved theme and history from localStorage
document.addEventListener('DOMContentLoaded', () => {
    // Load theme
    const savedTheme = localStorage.getItem('wonderai-theme');
    if (savedTheme) {
        currentTheme = savedTheme;
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon();
    }

    // Load voice settings
    const savedVoiceSettings = localStorage.getItem('wonderai-voice-settings');
    if (savedVoiceSettings) {
        voiceSettings = JSON.parse(savedVoiceSettings);
    }

    // Load conversations and chat history
    loadConversations();
    
    // Create a new conversation if none exists
    if (!currentConversationId) {
        startNewConversation();
    }

    // Custom version selector logic
    const versionSelectorCustom = document.getElementById('versionSelectorCustom');
    const versionSelectedBtn = document.getElementById('versionSelectedBtn');
    const versionOptions = document.getElementById('versionOptions');
    const versionSelectedText = document.getElementById('versionSelectedText');

    if (versionSelectorCustom && versionSelectedBtn && versionOptions && versionSelectedText) {
        versionSelectedBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            versionOptions.style.display = versionOptions.style.display === 'block' ? 'none' : 'block';
            versionSelectorCustom.classList.toggle('open');
        });
        Array.from(versionOptions.getElementsByClassName('version-option')).forEach(btn => {
            btn.addEventListener('click', function(e) {
                const version = btn.getAttribute('data-version');
                currentVersion = version;
                modelEndpoint = MODEL_ENDPOINTS[currentVersion];
                versionSelectedText.textContent = btn.textContent;
                versionOptions.style.display = 'none';
                versionSelectorCustom.classList.remove('open');
                showToast('Switched to ' + btn.textContent);
            });
        });
        // Close dropdown on outside click
        document.addEventListener('click', function(e) {
            if (!versionSelectorCustom.contains(e.target)) {
                versionOptions.style.display = 'none';
                versionSelectorCustom.classList.remove('open');
            }
        });
    }
});

// Loading Screen Handler
window.addEventListener('load', () => {
    // Create particles for the loading screen
    const particleContainer = document.getElementById('particleContainer');
    for (let i = 0; i < 50; i++) {
        createParticle(particleContainer);
    }
    
    // Simulate loading progress
    const progressBar = document.getElementById('progressBar');
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress >= 100) {
            clearInterval(progressInterval);
            // Start the fade out transition
            setTimeout(() => {
                const loadingScreen = document.getElementById('loadingScreen');
                loadingScreen.style.opacity = '0';
                
                setTimeout(() => {
                    loadingScreen.remove();
                }, 1500);
            }, 500); // Small delay after loading completes
        } else {
            progress += Math.random() * 10;
            progress = Math.min(progress, 100);
            progressBar.style.width = `${progress}%`;
        }
    }, 200);
});

function createParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random starting position
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = Math.random() * 3 + 1;
    const duration = Math.random() * 10 + 5;
    const delay = Math.random() * 5;
    
    particle.style.left = `${x}%`;
    particle.style.bottom = `${y}%`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.animation = `particle-animate ${duration}s linear ${delay}s infinite`;
    
    // Add color variation
    const hue = Math.random() * 60 - 30; // Vary within theme color range
    if (currentTheme === 'dark') {
        particle.style.backgroundColor = `hsl(160, 100%, ${50 + hue}%)`;
    } else {
        particle.style.backgroundColor = `hsl(200, 80%, ${40 + hue}%)`;
    }
    
    // Add slight blur for a glow effect
    particle.style.boxShadow = `0 0 ${size * 2}px ${size/2}px var(--secondary)`;
    
    container.appendChild(particle);
}

// Adjust textarea height as user types
const textarea = document.getElementById('inputField');
textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Theme toggle
document.getElementById('themeToggle').addEventListener('click', toggleTheme);

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wonderai-theme', currentTheme);
    
    // Update theme color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    metaThemeColor.setAttribute('content', currentTheme === 'dark' ? '#0a192f' : '#F8FAFC');
    
    updateThemeIcon();
    
    // Update history items with new theme
    renderChatHistory();
}

function updateThemeIcon() {
    const icon = document.querySelector('#themeToggle i');
    if (currentTheme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Toggle history sidebar
function toggleHistory() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
    
    if (sidebar.classList.contains('open')) {
        renderChatHistory();
    }
}

// Chat history functions
function saveChatHistory() {
    // Save the full conversations object
    localStorage.setItem('wonderai-conversations', JSON.stringify(conversations));
    renderChatHistory();
}

function loadConversations() {
    const saved = localStorage.getItem('wonderai-conversations');
    if (saved) {
        conversations = JSON.parse(saved);
        
        // Get the last conversation ID if exists
        const keys = Object.keys(conversations);
        if (keys.length > 0) {
            currentConversationId = keys[0]; // Most recent conversation
            conversationContext = conversations[currentConversationId].messages || [];
        }
        
        renderChatHistory();
    } else {
        // Initialize empty conversations object
        conversations = {};
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    
    // Check if date is today
    if (date.toDateString() === now.toDateString()) {
        return 'Today';
    }
    
    // Check if date is yesterday
    if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    
    // Otherwise return formatted date
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function renderChatHistory() {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '';
    
    if (Object.keys(conversations).length === 0) {
        container.innerHTML = '<p>No chat history yet</p>';
        return;
    }
    
    // Group conversations by date
    const groupedConversations = {};
    
    // Process each conversation
    Object.entries(conversations).forEach(([id, convo]) => {
        const date = new Date(convo.timestamp).toDateString();
        
        if (!groupedConversations[date]) {
            groupedConversations[date] = [];
        }
        
        groupedConversations[date].push({
            id: id,
            title: convo.title,
            timestamp: convo.timestamp,
            preview: convo.messages[0]?.content || "Empty conversation"
        });
    });
    
    // Sort dates in reverse chronological order
    const sortedDates = Object.keys(groupedConversations).sort((a, b) => 
        new Date(b) - new Date(a)
    );
    
    // Render each date group
    sortedDates.forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'conversation-group';
        
        // Add date divider
        const dateDivider = document.createElement('div');
        dateDivider.className = 'date-divider';
        dateDivider.textContent = formatDate(date);
        dateGroup.appendChild(dateDivider);
        
        // Sort conversations within the date in reverse chronological order
        const sortedConvos = groupedConversations[date].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        // Add each conversation
        sortedConvos.forEach(convo => {
            const historyItem = document.createElement('div');
            historyItem.className = 'chat-history-item';
            historyItem.dataset.id = convo.id;
            
            // Apply theme-specific styling
            if (currentTheme === 'light') {
                historyItem.style.background = 'rgba(0, 0, 0, 0.05)';
                historyItem.style.color = 'var(--text)';
            } else {
                historyItem.style.background = 'rgba(255, 255, 255, 0.05)';
                historyItem.style.color = 'var(--text)';
            }
            
            // Add theme indicator
            const themeIcon = currentTheme === 'light' ? 
                '<i class="fas fa-sun" style="margin-right: 8px; color: var(--primary);"></i>' : 
                '<i class="fas fa-moon" style="margin-right: 8px; color: var(--secondary);"></i>';
            
            // Highlight current conversation
            if (convo.id === currentConversationId) {
                historyItem.style.borderLeft = '3px solid var(--primary)';
                historyItem.style.paddingLeft = '7px';
            }
            
            // Use custom title if available, otherwise use preview
            const displayText = convo.title || convo.preview.substring(0, 30) + (convo.preview.length > 30 ? '...' : '');
            
            historyItem.innerHTML = `
                <div class="history-text">${themeIcon}${displayText}</div>
                <div>
                    <button class="rename-history" onclick="startRenameConversation(event, '${convo.id}')" title="Rename">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-history" onclick="deleteConversation('${convo.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            historyItem.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-history') && !e.target.closest('.rename-history')) {
                    loadConversation(convo.id);
                }
            });
            
            // Add hover effect with theme-specific styles
            historyItem.addEventListener('mouseover', () => {
                if (currentTheme === 'light') {
                    historyItem.style.background = 'rgba(0, 0, 0, 0.1)';
                } else {
                    historyItem.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            });
            
            historyItem.addEventListener('mouseout', () => {
                if (currentTheme === 'light') {
                    historyItem.style.background = 'rgba(0, 0, 0, 0.05)';
                } else {
                    historyItem.style.background = 'rgba(255, 255, 255, 0.05)';
                }
            });
            
            dateGroup.appendChild(historyItem);
        });
        
        container.appendChild(dateGroup);
    });
    
    // Add "New Chat" button at the top with theme styling
    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'action-btn';
    newChatBtn.style.width = '100%';
    newChatBtn.style.marginBottom = '15px';
    newChatBtn.style.background = 'var(--surface)';
    newChatBtn.style.color = 'var(--text)';
    newChatBtn.style.borderColor = 'var(--border)';
    
    const themeIcon = currentTheme === 'light' ? 
        '<i class="fas fa-sun" style="margin-right: 8px; color: var(--primary);"></i>' : 
        '<i class="fas fa-moon" style="margin-right: 8px; color: var(--secondary);"></i>';
        
    newChatBtn.innerHTML = `${themeIcon}<i class="fas fa-plus"></i> New Chat`;
    
    newChatBtn.addEventListener('mouseover', () => {
        newChatBtn.style.background = 'var(--primary)';
        newChatBtn.style.color = '#000';
    });
    
    newChatBtn.addEventListener('mouseout', () => {
        newChatBtn.style.background = 'var(--surface)';
        newChatBtn.style.color = 'var(--text)';
    });
    
    newChatBtn.addEventListener('click', () => {
        startNewConversation();
        toggleHistory();
    });
    
    container.insertBefore(newChatBtn, container.firstChild);
}

function startNewConversation() {
    // Generate a unique ID
    currentConversationId = Date.now().toString();
    
    // Initialize the new conversation
    conversations[currentConversationId] = {
        title: null,
        timestamp: new Date().toISOString(),
        messages: [] // This will store both user and AI messages
    };
    
    // Reset context
    conversationContext = [];
    
    // Clear the chat container
    document.getElementById('chatContainer').innerHTML = '';
    
    // Save to localStorage
    saveChatHistory();
    
    return currentConversationId;
}

function startRenameConversation(event, convId) {
    event.stopPropagation();
    const historyItem = document.querySelector(`.chat-history-item[data-id="${convId}"]`);
    if (!historyItem) return;
    
    const currentTitle = conversations[convId].title || (conversations[convId].messages[0]?.content || "New Conversation").substring(0, 30);
    
    // Replace content with input field
    const textContainer = historyItem.querySelector('.history-text');
    const originalHtml = textContainer.innerHTML;
    
    textContainer.innerHTML = `
        <input type="text" class="rename-input" value="${currentTitle.replace(/"/g, '&quot;')}" />
    `;
    
    const input = textContainer.querySelector('input');
    input.focus();
    input.select();
    
    // Handle input events
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            finishRenameConversation(convId, input.value);
        } else if (e.key === 'Escape') {
            textContainer.innerHTML = originalHtml;
        }
    });
    
    input.addEventListener('blur', () => {
        finishRenameConversation(convId, input.value);
    });
}

function finishRenameConversation(convId, newTitle) {
    if (!newTitle.trim()) {
        renderChatHistory();
        return;
    }
    
    conversations[convId].title = newTitle.trim();
    saveChatHistory();
    showToast('Conversation renamed');
}

function loadConversation(convId) {
    if (!conversations[convId]) return;
    
    // Set as current conversation
    currentConversationId = convId;
    
    // Load the conversation messages
    conversationContext = conversations[convId].messages || [];
    
    // Clear and rebuild the chat UI
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = '';
    
    // Display all messages in this conversation
    conversationContext.forEach(msg => {
        const isAI = msg.role === 'assistant';
        chatContainer.appendChild(createMessageElement(msg.content, isAI));
    });
    
    // Close sidebar
    toggleHistory();
}

function deleteConversation(convId) {
    // Remove the conversation
    delete conversations[convId];
    
    // If we deleted the current conversation, create a new one
    if (convId === currentConversationId) {
        startNewConversation();
        document.getElementById('chatContainer').innerHTML = '';
    }
    
    saveChatHistory();
    showToast('Conversation deleted');
}

function clearAllHistory() {
    conversations = {};
    startNewConversation();
    document.getElementById('chatContainer').innerHTML = '';
    saveChatHistory();
    showToast('All conversations cleared');
}

function clearChat() {
    document.getElementById('chatContainer').innerHTML = '';
    showToast('Chat cleared');
}

// Message handling functions
function createMessageElement(content, isAI = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
    
    const timestamp = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    // Add speech button for AI messages
    const ttsControls = isAI ? `
        <div class="tts-controls">
            <button class="tts-button play-tts" onclick="speakText(this)" title="Listen to this response">
                <i class="fas fa-volume-up"></i>
            </button>
            <button class="tts-button stop-tts" onclick="stopSpeaking()" style="display: none;" title="Stop speaking">
                <i class="fas fa-volume-mute"></i>
            </button>
            <div class="speaking-animation" style="display: none;">
                <div class="speaking-wave"></div>
                <div class="speaking-wave"></div>
                <div class="speaking-wave"></div>
            </div>
        </div>
    ` : '';

    // Message structure with improved design
    messageDiv.innerHTML = `
        <div class="message-avatar ${isAI ? 'ai-avatar' : 'user-avatar'}">
            ${isAI ? 'L' : 'Y'}
        </div>
        <div class="message-bubble">
            <div class="message-actions">
                <button class="message-btn" onclick="copyMessage(this)" title="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                </button>
                ${isAI ? `<button class="message-btn" onclick="deleteMessage(this)" title="Delete message">
                    <i class="fas fa-trash"></i>
                </button>` : ''}
            </div>
            <div class="message-info">
                <span>${isAI ? 'LAURIXY AI' : 'You'}</span>
            </div>
            ${content}
            <div class="timestamp">${timestamp}</div>
            ${ttsControls}
        </div>
    `;
    
    return messageDiv;
}

function copyMessage(button) {
    const text = button.closest('.message-bubble').querySelector('.message-content')?.textContent.trim() || '';
    navigator.clipboard.writeText(text);
    showToast('Message copied to clipboard');
}

function deleteMessage(button) {
    const message = button.closest('.message');
    const messageBubble = message.querySelector('.message-bubble');
    const isAiMessage = message.classList.contains('ai-message');
    const index = Array.from(message.parentNode.children).indexOf(message);
    
    // Check if this message is currently being read aloud, if so stop the speech
    if (currentSpeakingElement && (currentSpeakingElement === messageBubble || messageBubble.contains(currentSpeakingElement))) {
        stopSpeaking();
    }
    
    // If this conversation has stored messages
    if (currentConversationId && conversations[currentConversationId] && 
        conversations[currentConversationId].messages) {
        
        // Remove from conversation (need to account for possibly different indices)
        let msgIndex = -1;
        conversations[currentConversationId].messages.forEach((msg, i) => {
            if ((isAiMessage && msg.role === 'assistant') || 
                (!isAiMessage && msg.role === 'user')) {
                msgIndex++;
                if (msgIndex === Math.floor(index/2)) { // Divide by 2 as we have user+ai pairs
                    conversations[currentConversationId].messages.splice(i, 1);
                    return;
                }
            }
        });
        
        // Update conversation context
        conversationContext = conversations[currentConversationId].messages;
        
        // Save changes
        saveChatHistory();
    }
    
    message.remove();
    showToast('Message deleted');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    // Set the message
    toastMessage.textContent = message;
    
    // Add appropriate icon based on message type
    let iconClass = 'fa-info-circle';
    let borderColor = 'var(--primary)';
    
    if (type === 'error') {
        iconClass = 'fa-exclamation-circle';
        borderColor = 'var(--error)';
    } else if (type === 'success') {
        iconClass = 'fa-check-circle';
        borderColor = 'var(--success)';
    } else if (type === 'warning') {
        iconClass = 'fa-exclamation-triangle';
        borderColor = 'var(--warning)';
    }
    
    // Update icon and border color
    toast.querySelector('i').className = `fas ${iconClass}`;
    toast.style.borderLeftColor = borderColor;
    
    // Show the toast
    toast.classList.add('show');
    
    // Automatically hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Improved scroll to bottom function
function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    const smoothScroll = () => {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    };
    
    // Use both methods for better compatibility
    chatContainer.scrollTop = chatContainer.scrollHeight;
    smoothScroll();
    
    // Additional delayed scroll to ensure everything is rendered
    setTimeout(smoothScroll, 100);
}

// Voice input
function startVoiceInput() {
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        const recordingIndicator = document.getElementById('recordingIndicator');
        recordingIndicator.style.display = 'flex';
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('inputField').value = transcript;
            recordingIndicator.style.display = 'none';
            showToast('Voice input captured');
        };
        
        recognition.onerror = function(event) {
            recordingIndicator.style.display = 'none';
            showToast('Error in voice recognition: ' + event.error);
        };
        
        recognition.onend = function() {
            recordingIndicator.style.display = 'none';
        };
        
        recognition.start();
    } else {
        showToast('Voice recognition not supported in this browser');
    }
}

// Handle key press
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        generateResponse();
    }
}

// Generate AI response
async function generateResponse() {
    const input = document.getElementById('inputField').value.trim();
    if (!input) return;

    if (isGenerating) {
        stopGeneration();
        return;
    }

    const chatContainer = document.getElementById('chatContainer');
    const loading = document.getElementById('loading');
    const sendButton = document.getElementById('sendButton');
    const stopButton = document.getElementById('stopButton');

    // Create a new conversation if needed
    if (!currentConversationId) {
        startNewConversation();
    }

    // Add user message
    const userMessageElement = createMessageElement(input, false);
    chatContainer.appendChild(userMessageElement);
    
    // Scroll to bottom after adding user message
    scrollToBottom();
    
    // Add to conversation context
    const userMessage = {
        role: 'user',
        content: input,
        timestamp: new Date().toISOString()
    };
    
    // Update conversation
    conversations[currentConversationId].messages.push(userMessage);
    conversations[currentConversationId].timestamp = new Date().toISOString(); // Update timestamp
    conversationContext.push(userMessage);
    
    // Auto-generate title from first message if it doesn't have one
    if (!conversations[currentConversationId].title && conversations[currentConversationId].messages.length === 1) {
        conversations[currentConversationId].title = input.substring(0, 30) + (input.length > 30 ? '...' : '');
    }
    
    saveChatHistory();
    
    document.getElementById('inputField').value = '';
    document.getElementById('inputField').style.height = 'auto';
    loading.style.display = 'flex';
    sendButton.style.display = 'none';
    stopButton.style.display = 'block';
    isGenerating = true;

    try {
        controller = new AbortController();
        const signal = controller.signal;
        const typingInterval = { current: null };
        let aiResponse = '';
        // OpenRouter logic for all versions
        const messages = [];
        conversations[currentConversationId].messages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });
        // In generateResponse, use the correct API key for the selected version
        const response = await fetch(
            `https://openrouter.ai/api/v1/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEYS[currentVersion]}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'LAURIXY AI'
                },
                body: JSON.stringify({
                    model: modelEndpoint,
                    messages: messages,
                    stream: false
                }),
                signal: signal
            }
        );
        if (!response.ok) {
            const errorText = await response.text();
            showToast('API Error: ' + errorText, 'error');
            throw new Error(`API returned status: ${response.status}`);
        }
        const data = await response.json();
        aiResponse = data.choices?.[0]?.message?.content || 'No response from AI.';
        
        // Check if the user asked about who created/developed LAURIXY AI
        let enhancedResponse = aiResponse;
        const creatorQuestions = [
            "who made you", "who created you", "who create you", "who developed you", 
            "who is your creator", "who is your developer", "who is your owner",
            "who owns you", "who built you", "who designed you",
            "who is behind you", "who is the founder of laurixy ai", "who is the ceo of laurixy ai",
            "who is the founder of laurixy", "who is the ceo of laurixy",
            // Variations with 'laurixy ai'
            "who made laurixy ai", "who created laurixy ai", "who create laurixy ai", "who developed laurixy ai",
            "who is the creator of laurixy ai", "who is the developer of laurixy ai", "who is the owner of laurixy ai",
            "who owns laurixy ai", "who built laurixy ai", "who designed laurixy ai"
        ];
        // Check if user question matches any creator question patterns (case insensitive)
        const userQuestion = input.toLowerCase();
        const isAskingAboutCreator = creatorQuestions.some(question => 
            userQuestion.includes(question) || 
            userQuestion.includes(question.replace("you", "this")) ||
            userQuestion.includes(question.replace("your", "the"))
        );
        if (isAskingAboutCreator) {
            enhancedResponse = `<b>I was developed by LAURIXY Company. The Founder and CEO is Sheikh Haris.</b><br><br>` +
                "LAURIXY AI is an advanced artificial intelligence platform designed to build the future through innovative solutions. " +
                aiResponse;
        }
        
        // Create AI message element
        const aiMessage = createMessageElement('', true);
        chatContainer.appendChild(aiMessage);
        
        // Add to context
        const assistantMessage = {
            role: 'assistant',
            content: enhancedResponse,
            timestamp: new Date().toISOString()
        };
        conversations[currentConversationId].messages.push(assistantMessage);
        conversationContext.push(assistantMessage);
        saveChatHistory();
        
        let index = 0;
        const messageContent = aiMessage.querySelector('.message-bubble');
        messageContent.classList.add('typing-animation');
        
        function typeWriter() {
            if (index < enhancedResponse.length) {
                // Get the content up to the current index
                const currentText = enhancedResponse.substring(0, index + 1);
                
                // Update the message content with our new styling
                const messageWithInfo = `
                    <div class="message-actions">
                        <button class="message-btn" onclick="copyMessage(this)" title="Copy to clipboard">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="message-btn" onclick="deleteMessage(this)" title="Delete message">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    <div class="message-info">
                        <span>LAURIXY AI</span>
                    </div>
                    ${currentText}
                    <div class="timestamp">${new Date().toLocaleTimeString()}</div>
                    <div class="tts-controls">
                        <button class="tts-button play-tts" onclick="speakText(this)" title="Listen to this response">
                            <i class="fas fa-volume-up"></i>
                        </button>
                        <button class="tts-button stop-tts" onclick="stopSpeaking()" style="display: none;" title="Stop speaking">
                            <i class="fas fa-volume-mute"></i>
                        </button>
                        <div class="speaking-animation" style="display: none;">
                            <div class="speaking-wave"></div>
                            <div class="speaking-wave"></div>
                            <div class="speaking-wave"></div>
                        </div>
                    </div>
                `;
                
                messageContent.innerHTML = messageWithInfo;
                
                index++;
                typingInterval.current = setTimeout(typeWriter, 20);
            } else {
                messageContent.classList.remove('typing-animation');
                finishGeneration();
                
                // Auto-scroll to bottom when message is complete
                setTimeout(() => {
                    const chatContainer = document.getElementById('chatContainer');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }, 100);
            }
        }
        
        typeWriter();
        
        // Store reference to make it accessible for abort
        controller.typingInterval = typingInterval;
    } catch (error) {
        if (error.name === 'AbortError') {
            showToast('Generation stopped');
        } else {
            showToast('Error: ' + error.message);
            console.error('API Error:', error);
        }
        finishGeneration();
    } finally {
        loading.style.display = 'none';
    }
}

function stopGeneration() {
    if (controller) {
        // Stop the typing animation if it's running
        if (controller.typingInterval && controller.typingInterval.current) {
            clearTimeout(controller.typingInterval.current);
        }
        
        // Abort the fetch request
        controller.abort();
        controller = null;
    }
    finishGeneration();
    showToast('Response generation stopped');
}

function finishGeneration() {
    isGenerating = false;
    document.getElementById('sendButton').style.display = 'block';
    document.getElementById('stopButton').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
}

// Add these functions for text-to-speech functionality
// Text-to-speech functionality
let currentSpeech = null;
let currentSpeakingElement = null;

function speakText(button) {
    // Check if speech synthesis is available
    if (!window.speechSynthesis) {
        showToast('Text-to-speech is not supported in your browser', 'error');
        return;
    }
    
    // Stop any current speech
    stopSpeaking();
    
    // Check if a voice settings dialog is already open
    const existingDialog = document.querySelector('.voice-settings-dialog');
    if (existingDialog) existingDialog.remove();
    
    // Create voice settings dialog
    const dialog = document.createElement('div');
    dialog.className = 'voice-settings-dialog';
    dialog.innerHTML = `
        <div class="voice-settings-header">
            <h3>Voice Settings</h3>
            <button class="close-dialog" title="Close">×</button>
        </div>
        <div class="voice-settings-body">
            <div class="settings-row">
                <label>Voice Type:</label>
                <select id="voiceType">
                    <option value="auto" ${voiceSettings.voiceType === 'auto' ? 'selected' : ''}>Auto</option>
                    <option value="male" ${voiceSettings.voiceType === 'male' ? 'selected' : ''}>Male</option>
                    <option value="female" ${voiceSettings.voiceType === 'female' ? 'selected' : ''}>Female</option>
                </select>
            </div>
            <div class="settings-row">
                <label>Speed: ${voiceSettings.voiceRate.toFixed(1)}x</label>
                <input type="range" id="voiceRate" min="0.5" max="2" step="0.1" value="${voiceSettings.voiceRate}">
            </div>
            <div class="settings-row">
                <label>Pitch: ${voiceSettings.voicePitch.toFixed(1)}</label>
                <input type="range" id="voicePitch" min="0.5" max="2" step="0.1" value="${voiceSettings.voicePitch}">
            </div>
        </div>
        <div class="voice-settings-footer">
            <button class="play-now">Play Now</button>
            <button class="save-settings">Save Settings</button>
        </div>
    `;
    
    // Get the message bubble element
    const messageBubble = button.closest('.message-bubble');
    messageBubble.appendChild(dialog);
    
    // Extract text content
    const messageInfoNode = messageBubble.querySelector('.message-info');
    const timestampNode = messageBubble.querySelector('.timestamp');
    let messageText = '';
    let node = messageInfoNode.nextSibling;
    
    while (node && node !== timestampNode) {
        if (node.nodeType === 3 && node.textContent.trim() !== '') {
            messageText += node.textContent;
        } else if (node.nodeType === 1 && node.tagName !== 'DIV' && node.tagName !== 'BUTTON') {
            messageText += node.innerText || node.textContent;
        }
        node = node.nextSibling;
    }
    
    messageText = messageText.trim();
    
    if (!messageText) {
        showToast('No text content to read', 'warning');
        return;
    }
    
    // Event listeners
    dialog.querySelector('.close-dialog').addEventListener('click', () => {
        dialog.remove();
    });
    
    // Update labels when sliders change
    const rateSlider = dialog.querySelector('#voiceRate');
    rateSlider.addEventListener('input', () => {
        dialog.querySelector('label:nth-of-type(2)').textContent = `Speed: ${parseFloat(rateSlider.value).toFixed(1)}x`;
    });
    
    const pitchSlider = dialog.querySelector('#voicePitch');
    pitchSlider.addEventListener('input', () => {
        dialog.querySelector('label:nth-of-type(3)').textContent = `Pitch: ${parseFloat(pitchSlider.value).toFixed(1)}`;
    });
    
    // Save settings
    dialog.querySelector('.save-settings').addEventListener('click', () => {
        voiceSettings.voiceType = dialog.querySelector('#voiceType').value;
        voiceSettings.voiceRate = parseFloat(rateSlider.value);
        voiceSettings.voicePitch = parseFloat(pitchSlider.value);
        
        // Save to localStorage
        localStorage.setItem('wonderai-voice-settings', JSON.stringify(voiceSettings));
        
        showToast('Voice settings saved', 'success');
        dialog.remove();
    });
    
    // Play now
    dialog.querySelector('.play-now').addEventListener('click', () => {
        // Get current values from dialog
        const currentVoiceType = dialog.querySelector('#voiceType').value;
        const currentRate = parseFloat(rateSlider.value);
        const currentPitch = parseFloat(pitchSlider.value);
        
        dialog.remove();
        playTextWithSettings(messageBubble, messageText, currentVoiceType, currentRate, currentPitch);
    });
}

// Function to play text with specific settings
function playTextWithSettings(messageBubble, messageText, voiceType, rate, pitch) {
    // Show speaking state
    messageBubble.classList.add('tts-active');
    const playButton = messageBubble.querySelector('.play-tts');
    playButton.style.display = 'none';
    const stopButton = messageBubble.querySelector('.stop-tts');
    stopButton.style.display = 'inline-block';
    const animation = messageBubble.querySelector('.speaking-animation');
    animation.style.display = 'inline-block';
    
    // Reference to the current message being spoken
    currentSpeakingElement = messageBubble;
    
    // Create and configure speech utterance
    const speech = new SpeechSynthesisUtterance(messageText);
    speech.lang = 'en-US';
    
    // Apply voice settings
    speech.rate = rate;
    speech.pitch = pitch;
    
    // Get available voices
    let voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
        // If voices array is empty, wait for voices to load
        speechSynthesis.onvoiceschanged = function() {
            voices = speechSynthesis.getVoices();
            setVoiceAndSpeak();
        };
    } else {
        setVoiceAndSpeak();
    }
    
    function setVoiceAndSpeak() {
        const voices = speechSynthesis.getVoices();
        let selectedVoice = null;
        
        // Filter voices based on selected type
        if (voiceType === 'male') {
            selectedVoice = voices.find(voice => 
                voice.name.includes('Male') || 
                voice.name.includes('Daniel') || 
                voice.name.includes('David')
            );
        } else if (voiceType === 'female') {
            selectedVoice = voices.find(voice => 
                voice.name.includes('Female') || 
                voice.name.includes('Samantha') || 
                voice.name.includes('Karen')
            );
        } else {
            // Auto - prioritize high-quality voices
            selectedVoice = voices.find(voice => 
                voice.name.includes('Google') || 
                voice.name.includes('Premium')
            );
        }
        
        // Fallback if no matching voice
        if (!selectedVoice && voices.length > 0) {
            selectedVoice = voices[0];
        }
        
        if (selectedVoice) {
            speech.voice = selectedVoice;
        }
        
        // Event for when speech ends
        speech.onend = function() {
            resetSpeakingState();
            showToast('Finished speaking', 'success');
        };
        
        speech.onerror = function() {
            resetSpeakingState();
            showToast('Error occurred while speaking', 'error');
        };
        
        // Start speaking
        window.speechSynthesis.speak(speech);
        currentSpeech = speech;
        
        showToast(`Speaking with ${selectedVoice ? selectedVoice.name : 'default voice'}`, 'info');
    }
}

function stopSpeaking() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        resetSpeakingState();
    }
}

function resetSpeakingState() {
    if (currentSpeakingElement) {
        currentSpeakingElement.classList.remove('tts-active');
        currentSpeakingElement.querySelector('.play-tts').style.display = 'inline-block';
        currentSpeakingElement.querySelector('.stop-tts').style.display = 'none';
        currentSpeakingElement.querySelector('.speaking-animation').style.display = 'none';
        currentSpeakingElement = null;
        currentSpeech = null;
    }
}

// Handle page visibility change (stop speaking when tab is hidden)
document.addEventListener('visibilitychange', function() {
    if (document.hidden && currentSpeech) {
        stopSpeaking();
    }
});

// Scroll to top functionality
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
const chatContainerElem = document.getElementById('chatContainer');

chatContainerElem.addEventListener('scroll', () => {
    if (chatContainerElem.scrollTop > 300) {
        scrollToTopBtn.classList.add('show');
    } else {
        scrollToTopBtn.classList.remove('show');
    }
});

scrollToTopBtn.addEventListener('click', () => {
    chatContainerElem.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}); 