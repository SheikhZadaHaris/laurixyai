const API_KEY = 'AIzaSyBiQDl1qxHL4hOe5yP4BPqBWlIETuU3RxQ';
let currentTheme = 'dark';
let conversations = {};
let currentConversationId = null;
let conversationContext = [];
let isGenerating = false;
let controller = null;
let recognition = null;

// Load saved theme and history from localStorage
document.addEventListener('DOMContentLoaded', () => {
    // Load theme
    const savedTheme = localStorage.getItem('wonderai-theme');
    if (savedTheme) {
        currentTheme = savedTheme;
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon();
    }

    // Load conversations and chat history
    loadConversations();
    
    // Create a new conversation if none exists
    if (!currentConversationId) {
        startNewConversation();
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
                    <button class="rename-history" onclick="startRenameConversation('${convo.id}')" title="Rename">
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

function startRenameConversation(convId) {
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
            ${isAI ? 'W' : 'Y'}
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
                <span>${isAI ? 'Wonder AI' : 'You'}</span>
            </div>
            ${content}
            <div class="timestamp">${timestamp}</div>
            ${ttsControls}
        </div>
    `;
    
    return messageDiv;
}

function copyMessage(button) {
    const text = button.closest('.message-bubble').querySelector('.message-info').nextSibling.nextSibling.textContent.trim();
    navigator.clipboard.writeText(text);
    showToast('Message copied to clipboard');
}

function deleteMessage(button) {
    const message = button.closest('.message');
    const isAiMessage = message.classList.contains('ai-message');
    const index = Array.from(message.parentNode.children).indexOf(message);
    
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

        // Build request payload - include context from conversation for memory
        const requestBody = {
            contents: []
        };
        
        // Add the conversation history as context
        conversations[currentConversationId].messages.forEach(msg => {
            let role = msg.role;
            let parts = [{ text: msg.content }];
            
            requestBody.contents.push({
                role: role,
                parts: parts
            });
        });

        // Use text model
        const modelEndpoint = 'gemini-1.5-pro';

        console.log(`Using model: ${modelEndpoint}`);
        console.log('Context length:', requestBody.contents.length);
        
        const typingInterval = { current: null };
        
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${modelEndpoint}:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: signal
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API returned status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
            console.error('Invalid API response format:', data);
            throw new Error('Invalid response from AI service');
        }
        
        const aiResponse = data.candidates[0].content.parts[0].text;
        
        // Create AI message element
        const aiMessage = createMessageElement('', true);
        chatContainer.appendChild(aiMessage);
        
        // Add to context
        const assistantMessage = {
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString()
        };
        conversations[currentConversationId].messages.push(assistantMessage);
        conversationContext.push(assistantMessage);
        saveChatHistory();
        
        let index = 0;
        const messageContent = aiMessage.querySelector('.message-bubble');
        messageContent.classList.add('typing-animation');
        
        function typeWriter() {
            if (index < aiResponse.length) {
                // Get the content up to the current index
                const currentText = aiResponse.substring(0, index + 1);
                
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
                        <span>Wonder AI</span>
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
    
    // Get the message text - extracting only the AI response text content
    const messageBubble = button.closest('.message-bubble');
    // Extract clean text content without including UI elements
    const messageInfoNode = messageBubble.querySelector('.message-info');
    const timestampNode = messageBubble.querySelector('.timestamp');
    const ttsControlsNode = messageBubble.querySelector('.tts-controls');
    
    // Create a range to extract just the message content
    let messageText = '';
    let node = messageInfoNode.nextSibling;
    
    while (node && node !== timestampNode) {
        if (node.nodeType === 3 && node.textContent.trim() !== '') {
            // Text node - add its content
            messageText += node.textContent;
        } else if (node.nodeType === 1 && node.tagName !== 'DIV' && node.tagName !== 'BUTTON') {
            // Element node (not container elements) - add its text
            messageText += node.innerText || node.textContent;
        }
        node = node.nextSibling;
    }
    
    messageText = messageText.trim();
    
    if (!messageText) {
        showToast('No text content to read', 'warning');
        return;
    }
    
    // Show speaking state
    messageBubble.classList.add('tts-active');
    button.style.display = 'none';
    const stopButton = messageBubble.querySelector('.stop-tts');
    stopButton.style.display = 'inline-block';
    const animation = messageBubble.querySelector('.speaking-animation');
    animation.style.display = 'inline-block';
    
    // Reference to the current message being spoken
    currentSpeakingElement = messageBubble;
    
    // Create and configure speech utterance
    const speech = new SpeechSynthesisUtterance(messageText);
    speech.lang = 'en-US';
    
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
        // Try to find a good voice
        const voices = speechSynthesis.getVoices();
        // Prioritize high-quality voices
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Google') || 
            voice.name.includes('Female') || 
            voice.name.includes('Samantha') ||
            voice.name.includes('Daniel')
        );
        
        if (preferredVoice) {
            speech.voice = preferredVoice;
        }
        
        // Adjust speech rate for better comprehension
        speech.rate = 0.95; // Slightly slower than default for better clarity
        speech.pitch = 1.0;
        
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
        
        showToast('Speaking AI response', 'info');
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