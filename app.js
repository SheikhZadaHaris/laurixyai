/* ============================================================
   LAURIXY AI — MAIN APPLICATION
   Orchestrator: ties together all modules, manages state & events
   ============================================================ */

const LaurixyApp = (() => {
    'use strict';

    const { $, $$, showToast, generateId, getLocal, setLocal } = LaurixyUtils;

    /* ======================================================
       STATE
       ====================================================== */
    let currentChatId = null;
    let chats = {};            // { chatId: { title, createdAt, messages: [] } }
    let currentMessages = [];
    let apiKey = '';

    // Mode toggles
    let thinkingMode = false;

    /* ======================================================
       INITIALIZATION
       ====================================================== */
    function init() {
        console.log('[LAURIXY AI] Initializing...');

        // Initialize Firebase
        LaurixyFirebase.init();

        // Initialize UI
        LaurixyUI.init();

        // Initialize Canvas
        LaurixyCanvas.init();

        // Admin logic is now handled separately or directly via Firebase


        // Initialize Voice settings UI
        LaurixyVoice.initSettingsUI();

        // Setup event listeners
        setupAuthListeners();
        setupChatListeners();
        setupModeListeners();
        setupSettingsListeners();
        setupVoiceListeners();
        setupExportListeners();
        setupSuggestionListeners();

        // Check for APK promotion (Android users in browser)
        if (LaurixyUtils.isAndroid() && !LaurixyUtils.isWebView()) {
            const dismissed = LaurixyUtils.getLocal('laurixy_apk_prompt_dismissed');
            if (!dismissed) {
                setTimeout(() => {
                    LaurixyUI.showModal('download-modal');
                }, 4000); // Wait 4s before prompting
            }
        }

        // Listen for auth state
        LaurixyFirebase.onAuthStateChanged(handleAuthStateChange);

        console.log('[LAURIXY AI] Ready');
    }

    /* ======================================================
       AUTH STATE HANDLER
       ====================================================== */
    async function handleAuthStateChange(user) {
        if (user) {
            // User is signed in
            await onUserSignedIn(user);
        } else if (LaurixyFirebase.getIsGuest()) {
            // Guest user - already handled
        } else {
            // No user - show auth screen
            LaurixyUI.showAuth();
        }
    }

    async function onUserSignedIn(user) {
        LaurixyUI.showApp();
        LaurixyUI.updateUserInfo(user);

        // Load API key
        apiKey = await LaurixyFirebase.getApiKey();
        if ($('#api-key-input') && apiKey) {
            $('#api-key-input').value = apiKey;
        }

        // Load chats
        chats = await LaurixyFirebase.loadAllChats();
        renderChatList();

        // Check admin state
        const isAdmin = await LaurixyFirebase.isAdmin();
        const btnAdmin = $('#btn-admin');
        if (btnAdmin) btnAdmin.style.display = isAdmin ? '' : 'none';

        // Check if user is blocked
        const userProfileRef = await firebase.database().ref(`users/${user.uid}/profile`).once('value');
        const profile = userProfileRef.val() || {};
        if (profile.isBlocked) {
            showToast('Your account has been suspended by the administrator.', 'error');
            const input = $('#chat-input');
            if (input) {
                input.value = 'Account suspended.';
                input.disabled = true;
            }
            const btnSend = $('#btn-send');
            if (btnSend) btnSend.disabled = true;
        }

        // Apply global settings overlay if forced
        const globalSettings = await LaurixyFirebase.getGlobalSettings();
        if (globalSettings && globalSettings.forceApi && globalSettings.globalApiKey) {
            apiKey = globalSettings.globalApiKey; // Override user's local or firebase DB key entirely for runtime
            console.log('[LAURIXY AI] Global Master API Key Enforced.');
        }

        // Request Device Permissions (Mic/Storage) for APK/Mobile compatibility
        try { await LaurixyFirebase.requestAppPermissions(); } catch(e){}

        // Log login event via raw firebase db call since Admin module shifted
        try { await LaurixyFirebase.addSystemLog(`User logged in: ${user.email || 'Unknown'}`); } catch(e){}

        // Update model indicator
        updateModelDisplay();

        // Show welcome or last chat
        LaurixyUI.showWelcome();
    }

    /* ======================================================
       AUTH EVENT LISTENERS
       ====================================================== */
    function setupAuthListeners() {
        // Login form
        const loginForm = $('#login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                LaurixyUI.hideAuthError();
                LaurixyUI.setAuthLoading('btn-login', true);

                const email = $('#login-email').value;
                const password = $('#login-password').value;
                const result = await LaurixyFirebase.loginWithEmail(email, password);

                LaurixyUI.setAuthLoading('btn-login', false);
                if (!result.success) {
                    LaurixyUI.showAuthError(result.error);
                }
            });
        }

        // Register form
        const registerForm = $('#register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                LaurixyUI.hideAuthError();
                LaurixyUI.setAuthLoading('btn-register', true);

                const name = $('#register-name').value;
                const email = $('#register-email').value;
                const password = $('#register-password').value;
                const result = await LaurixyFirebase.registerWithEmail(email, password, name);

                LaurixyUI.setAuthLoading('btn-register', false);
                if (!result.success) {
                    LaurixyUI.showAuthError(result.error);
                }
            });
        }

        // Google login
        const btnGoogle = $('#btn-google-login');
        if (btnGoogle) {
            btnGoogle.addEventListener('click', async () => {
                const result = await LaurixyFirebase.loginWithGoogle();
                if (!result.success) {
                    LaurixyUI.showAuthError(result.error);
                }
            });
        }

        // Guest login
        const btnGuest = $('#btn-guest-login');
        if (btnGuest) {
            btnGuest.addEventListener('click', () => {
                const result = LaurixyFirebase.loginAsGuest();
                if (result.success) {
                    onUserSignedIn(result.user);
                    showToast('Logged in as Guest', 'info');
                }
            });
        }

        // Logout
        const btnLogout = $('#btn-logout');
        if (btnLogout) {
            btnLogout.addEventListener('click', async () => {
                await LaurixyFirebase.logout();
                chats = {};
                currentChatId = null;
                currentMessages = [];
                apiKey = '';
                LaurixyUI.showAuth();
                showToast('Logged out', 'info');
            });
        }
    }

    /* ======================================================
       CHAT EVENT LISTENERS
       ====================================================== */
    function setupChatListeners() {
        // New chat
        const btnNewChat = $('#btn-new-chat');
        if (btnNewChat) {
            btnNewChat.addEventListener('click', () => {
                createNewChat();
            });
        }

        // Send message
        const btnSend = $('#btn-send');
        if (btnSend) {
            btnSend.addEventListener('click', sendMessage);
        }

        // Stop generation
        const btnStop = $('#btn-stop');
        if (btnStop) {
            btnStop.addEventListener('click', () => {
                LaurixyAI.stopGeneration();
                LaurixyUI.setGenerating(false);
                LaurixyUI.finalizeLastAssistantMessage();
                showToast('Generation stopped', 'info');
            });
        }

        // Chat input — Enter to send, Shift+Enter for newline
        const chatInput = $('#chat-input');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Search chats
        const chatSearch = $('#chat-search');
        if (chatSearch) {
            chatSearch.addEventListener('input', LaurixyUtils.debounce(() => {
                LaurixyUI.filterChatList(chatSearch.value);
            }, 200));
        }

        // Sidebar toggle
        const btnSidebarToggle = $('#btn-sidebar-toggle');
        if (btnSidebarToggle) {
            btnSidebarToggle.addEventListener('click', LaurixyUI.toggleSidebar);
        }

        const btnSidebarClose = $('#btn-sidebar-close');
        if (btnSidebarClose) {
            btnSidebarClose.addEventListener('click', LaurixyUI.toggleSidebar);
        }

        // Sidebar backdrop — click to close on mobile
        const sidebarBackdrop = $('#sidebar-backdrop');
        if (sidebarBackdrop) {
            sidebarBackdrop.addEventListener('click', () => {
                LaurixyUI.closeSidebar();
            });
        }

        // Download App Modal
        const btnDownloadApp = $('#btn-download-app');
        if (btnDownloadApp) {
            btnDownloadApp.addEventListener('click', () => {
                LaurixyUI.showModal('download-modal');
                LaurixyUI.closeSidebar(); // Close sidebar on mobile
            });
        }

        const btnDownloadClose = $('#btn-download-close');
        if (btnDownloadClose) {
            btnDownloadClose.addEventListener('click', () => {
                LaurixyUI.hideModal('download-modal');
                // Remember dismissal
                LaurixyUtils.setLocal('laurixy_apk_prompt_dismissed', true);
            });
        }

        const linkApkDownload = $('#link-apk-download');
        if (linkApkDownload) {
            linkApkDownload.addEventListener('click', () => {
                LaurixyUI.hideModal('download-modal');
                LaurixyUtils.setLocal('laurixy_apk_prompt_dismissed', true);
            });
        }
    }

    /* ======================================================
       MODE LISTENERS
       ====================================================== */
    function setupModeListeners() {
        // Thinking mode
        const btnThinking = $('#btn-thinking-mode');
        if (btnThinking) {
            btnThinking.addEventListener('click', () => {
                thinkingMode = !thinkingMode;
                if (thinkingMode) {
                    btnThinking.classList.add('active');
                } else {
                    btnThinking.classList.remove('active');
                }
                updateModelDisplay();
            });
        }
    }

    function updateModelDisplay() {
        const mode = LaurixyAI.resolveMode(thinkingMode);
        LaurixyAI.setMode(mode);
        LaurixyUI.updateModelIndicator(LaurixyAI.getModelName());
    }

    /* ======================================================
       SETTINGS LISTENERS
       ====================================================== */
    function setupSettingsListeners() {
        // Open settings
        const btnSettings = $('#btn-settings');

        if (btnSettings) {
            btnSettings.addEventListener('click', async () => {
                // Reload API key
                apiKey = await LaurixyFirebase.getApiKey();
                if ($('#api-key-input')) {
                    $('#api-key-input').value = apiKey || '';
                }

                // Check and show admin enforce message if needed
                const globalSettings = await LaurixyFirebase.getGlobalSettings();
                const userApiSection = $('#user-api-section');
                const adminApiMsg = $('#admin-api-message');
                
                if (globalSettings && globalSettings.forceApi && globalSettings.globalApiKey) {
                    if (userApiSection) userApiSection.classList.add('hidden');
                    if (adminApiMsg) adminApiMsg.classList.remove('hidden');
                } else {
                    if (userApiSection) userApiSection.classList.remove('hidden');
                    if (adminApiMsg) adminApiMsg.classList.add('hidden');
                }

                LaurixyUI.showModal('settings-modal');
            });
        }

        // Close settings
        const btnSettingsClose = $('#btn-settings-close');
        if (btnSettingsClose) {
            btnSettingsClose.addEventListener('click', () => {
                LaurixyUI.hideModal('settings-modal');
            });
        }

        // Save API key
        const btnSaveKey = $('#btn-save-api-key');
        if (btnSaveKey) {
            btnSaveKey.addEventListener('click', async () => {
                const input = $('#api-key-input');
                const status = $('#api-key-status');
                const key = input ? input.value.trim() : '';

                if (!key) {
                    status.textContent = 'Please enter an API key.';
                    status.className = 'settings-status error';
                    return;
                }

                const result = await LaurixyFirebase.saveApiKey(key);
                if (result.success) {
                    apiKey = key;
                    status.textContent = 'API key saved successfully!';
                    status.className = 'settings-status success';
                    showToast('API key saved', 'success');
                } else {
                    status.textContent = 'Failed to save: ' + (result.error || '');
                    status.className = 'settings-status error';
                }
            });
        }

        // Remove API key
        const btnRemoveKey = $('#btn-remove-api-key');
        if (btnRemoveKey) {
            btnRemoveKey.addEventListener('click', async () => {
                const status = $('#api-key-status');
                const result = await LaurixyFirebase.removeApiKey();
                if (result.success) {
                    apiKey = '';
                    if ($('#api-key-input')) $('#api-key-input').value = '';
                    status.textContent = 'API key removed.';
                    status.className = 'settings-status success';
                    showToast('API key removed', 'info');
                }
            });
        }

        // Close modal on overlay click
        $$('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    }

    /* ======================================================
       VOICE LISTENERS
       ====================================================== */
    function setupVoiceListeners() {
        // Mic button
        const btnVoice = $('#btn-voice');
        if (btnVoice) {
            btnVoice.addEventListener('click', () => {
                LaurixyVoice.startListening();
            });
        }

        // Voice cancel
        const btnVoiceCancel = $('#btn-voice-cancel');
        if (btnVoiceCancel) {
            btnVoiceCancel.addEventListener('click', () => {
                LaurixyVoice.hideVoiceOverlay();
            });
        }

        // Voice send
        const btnVoiceSend = $('#btn-voice-send');
        if (btnVoiceSend) {
            btnVoiceSend.addEventListener('click', () => {
                const transcript = LaurixyVoice.getTranscript();
                if (transcript) {
                    const input = $('#chat-input');
                    if (input) {
                        input.value = transcript;
                        LaurixyUtils.autoResize(input);
                        LaurixyUI.setSendEnabled(true);
                    }
                    LaurixyVoice.hideVoiceOverlay();
                    sendMessage();
                } else {
                    showToast('No speech detected', 'warning');
                }
            });
        }
    }

    /* ======================================================
       EXPORT LISTENERS
       ====================================================== */
    function setupExportListeners() {
        // Open export
        const btnExport = $('#btn-export-chat');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (!currentChatId || currentMessages.length === 0) {
                    showToast('No chat to export', 'warning');
                    return;
                }
                LaurixyUI.showModal('export-modal');
            });
        }

        // Close export
        const btnExportClose = $('#btn-export-close');
        if (btnExportClose) {
            btnExportClose.addEventListener('click', () => {
                LaurixyUI.hideModal('export-modal');
            });
        }

        // Export TXT
        const btnExportTxt = $('#btn-export-txt');
        if (btnExportTxt) {
            btnExportTxt.addEventListener('click', () => {
                const title = chats[currentChatId]?.title || 'Chat';
                LaurixyUtils.exportAsTxt(currentMessages, title);
                LaurixyUI.hideModal('export-modal');
                showToast('Chat exported as TXT', 'success');
            });
        }

        // Export JSON
        const btnExportJson = $('#btn-export-json');
        if (btnExportJson) {
            btnExportJson.addEventListener('click', () => {
                const title = chats[currentChatId]?.title || 'Chat';
                LaurixyUtils.exportAsJson(currentMessages, title);
                LaurixyUI.hideModal('export-modal');
                showToast('Chat exported as JSON', 'success');
            });
        }
    }

    /* ======================================================
       SUGGESTION LISTENERS
       ====================================================== */
    function setupSuggestionListeners() {
        $$('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.dataset.prompt;
                if (prompt) {
                    const input = $('#chat-input');
                    if (input) {
                        input.value = prompt;
                        LaurixyUtils.autoResize(input);
                        LaurixyUI.setSendEnabled(true);
                    }
                    sendMessage();
                }
            });
        });
    }

    /* ======================================================
       CHAT MANAGEMENT
       ====================================================== */
    function createNewChat() {
        const chatId = generateId('chat');
        chats[chatId] = {
            title: 'New Chat',
            createdAt: Date.now(),
            messages: []
        };
        currentChatId = chatId;
        currentMessages = [];
        LaurixyUI.showWelcome();
        renderChatList();
        LaurixyFirebase.saveChat(chatId, chats[chatId]);

        // Clear input
        const input = $('#chat-input');
        if (input) {
            input.value = '';
            LaurixyUtils.autoResize(input);
            LaurixyUI.setSendEnabled(false);
        }

        // Mobile: close sidebar
        if (window.innerWidth <= 768) {
            LaurixyUI.closeSidebar();
        }
    }

    function selectChat(chatId) {
        if (!chats[chatId]) return;

        currentChatId = chatId;
        currentMessages = chats[chatId].messages || [];

        if (currentMessages.length > 0) {
            LaurixyUI.hideWelcome();
            LaurixyUI.renderMessages(currentMessages);
        } else {
            LaurixyUI.showWelcome();
        }

        renderChatList();

        // Mobile: close sidebar
        if (window.innerWidth <= 768) {
            LaurixyUI.closeSidebar();
        }
    }

    async function deleteChat(chatId) {
        await LaurixyFirebase.deleteChat(chatId);
        delete chats[chatId];

        if (currentChatId === chatId) {
            currentChatId = null;
            currentMessages = [];
            LaurixyUI.showWelcome();
        }

        renderChatList();
        showToast('Chat deleted', 'info');
    }

    async function renameChat(chatId, newTitle) {
        if (!chats[chatId]) return;
        chats[chatId].title = newTitle;
        await LaurixyFirebase.updateChatTitle(chatId, newTitle);
        renderChatList();
        showToast('Chat renamed', 'success');
    }

    function renderChatList() {
        LaurixyUI.renderChatList(chats, currentChatId, selectChat, deleteChat, renameChat);
    }

    /* ======================================================
       SEND MESSAGE
       ====================================================== */
    async function sendMessage() {
        const input = $('#chat-input');
        if (!input || input.disabled) return;

        // Check ban status live before sending
        if (!LaurixyFirebase.getIsGuest()) {
            const user = LaurixyFirebase.getCurrentUser();
            if (user) {
                const snap = await firebase.database().ref(`users/${user.uid}/profile/isBlocked`).once('value');
                if (snap.val() === true) {
                    showToast('Action Denied. Account is suspended.', 'error');
                    return;
                }
            }
        }


        const text = input.value.trim();
        if (!text) return;

        // Ensure we have a chat
        if (!currentChatId) {
            createNewChat();
        }

        // Clear input
        input.value = '';
        LaurixyUtils.autoResize(input);
        LaurixyUI.setSendEnabled(false);

        // Add user message
        const userMsg = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        currentMessages.push(userMsg);
        LaurixyUI.appendMessage(userMsg, currentMessages.length - 1);

        // Save to DB
        chats[currentChatId].messages = currentMessages;
        LaurixyFirebase.updateChatMessages(currentChatId, currentMessages);



        // Prepare messages for API
        const apiMessages = currentMessages
            .filter(m => !m.imageUrl)
            .map(m => {
                const msg = { role: m.role, content: m.content };
                if (m.reasoning_details) {
                    msg.reasoning_details = m.reasoning_details;
                }
                return msg;
            });

        // Show streaming placeholder
        const aiMsgIndex = currentMessages.length;
        LaurixyUI.appendStreamingPlaceholder(aiMsgIndex, LaurixyAI.getModelName());
        LaurixyUI.setGenerating(true);

        // Stream AI response
        let finalContent = '';
        let finalThinking = '';

        let activeApiKey = apiKey;
        const globalSettings = await LaurixyFirebase.getGlobalSettings();
        if (globalSettings && globalSettings.forceApi && globalSettings.globalApiKey) {
            activeApiKey = globalSettings.globalApiKey;
        }

        if (!activeApiKey) {
            showToast('Please set your OpenRouter API Key in settings first.', 'error');
            LaurixyUI.setGenerating(false);
            LaurixyUI.finalizeLastAssistantMessage();
            currentMessages.pop(); // Remove the placeholder
            return;
        }

        LaurixyAI.streamChat(
            activeApiKey,
            apiMessages,
            // onToken
            (content, thinking) => {
                finalContent = content;
                finalThinking = thinking;
                LaurixyUI.updateLastAssistantMessage(content, thinking || null);
            },
            // onThinking
            (thinking) => {
                finalThinking = thinking;
            },
            // onComplete
            async (content, thinking, reasoningDetails) => {
                LaurixyUI.setGenerating(false);
                LaurixyUI.finalizeLastAssistantMessage();

                const aiMsg = {
                    role: 'assistant',
                    content: content || finalContent,
                    thinking: thinking || finalThinking || null,
                    reasoning_details: reasoningDetails || null,
                    modelName: LaurixyAI.getModelName(),
                    timestamp: Date.now()
                };
                currentMessages.push(aiMsg);

                // Save
                chats[currentChatId].messages = currentMessages;
                LaurixyFirebase.updateChatMessages(currentChatId, currentMessages);

                // Voice response
                LaurixyVoice.speak(content || finalContent);

                // Auto-generate title after first exchange
                if (currentMessages.length === 2 && chats[currentChatId].title === 'New Chat') {
                    const title = await LaurixyAI.generateTitle(apiKey, text, content || finalContent);
                    chats[currentChatId].title = title;
                    LaurixyFirebase.updateChatTitle(currentChatId, title);
                    renderChatList();
                }
            },
            // onError
            (errorMsg) => {
                LaurixyUI.setGenerating(false);
                LaurixyUI.finalizeLastAssistantMessage();

                const aiMsg = {
                    role: 'assistant',
                    content: errorMsg,
                    modelName: LaurixyAI.getModelName(),
                    timestamp: Date.now()
                };
                currentMessages.push(aiMsg);
                LaurixyUI.updateLastAssistantMessage(errorMsg);

                chats[currentChatId].messages = currentMessages;
                LaurixyFirebase.updateChatMessages(currentChatId, currentMessages);

                showToast(errorMsg, 'error');
            }
        );
    }

    /* ======================================================
       MESSAGE ACTIONS
       ====================================================== */
    function copyMessage(index) {
        const msg = currentMessages[index];
        if (msg) {
            LaurixyUtils.copyToClipboard(msg.content);
            showToast('Message copied', 'success');
        }
    }

    function readMessage(index) {
        const msg = currentMessages[index];
        if (msg) {
            LaurixyVoice.speak(msg.content, true); // Force speak even if auto-replies off
        }
    }

    function deleteMessage(index) {
        if (index < 0 || index >= currentMessages.length) return;
        
        // Stop reading if we are deleting
        LaurixyVoice.stopSpeaking();

        currentMessages.splice(index, 1);
        chats[currentChatId].messages = currentMessages;
        LaurixyFirebase.updateChatMessages(currentChatId, currentMessages);

        // Re-render
        if (currentMessages.length > 0) {
            LaurixyUI.renderMessages(currentMessages);
        } else {
            LaurixyUI.showWelcome();
        }
        showToast('Message deleted', 'info');
    }

    function regenerateMessage(index) {
        // Stop any active TTS reading
        LaurixyVoice.stopSpeaking();

        // Find the last user message before this index
        let lastUserIdx = -1;
        for (let i = index; i >= 0; i--) {
            if (currentMessages[i].role === 'user') {
                lastUserIdx = i;
                break;
            }
        }

        if (lastUserIdx === -1) return;

        const userText = currentMessages[lastUserIdx].content;

        // Keep all existing messages (don't delete old response)
        // Just re-send the same user query — the new AI response will appear below
        const input = $('#chat-input');
        if (input) {
            input.value = userText;
            LaurixyUtils.autoResize(input);
            LaurixyUI.setSendEnabled(true);
        }
        sendMessage();
    }

    /* ======================================================
       PUBLIC API
       ====================================================== */
    return {
        init,
        copyMessage,
        readMessage,
        deleteMessage,
        regenerateMessage
    };
})();

/* ======================================================
   BOOTSTRAP — Start the application when DOM is ready
   ====================================================== */
document.addEventListener('DOMContentLoaded', () => {
    LaurixyApp.init();
});
