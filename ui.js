/* ============================================================
   LAURIXY AI — UI MODULE
   All DOM manipulation, rendering, and UI state management
   ============================================================ */

const LaurixyUI = (() => {
    'use strict';

    const { $, $$, escapeHtml, renderMarkdown, formatTime, truncate, showToast } = LaurixyUtils;

    /* -------- State -------- */
    let sidebarOpen = true;

    /* -------- Auth Particles -------- */
    function initAuthParticles() {
        const container = $('#auth-particles');
        if (!container) return;
        for (let i = 0; i < 50; i++) {
            const particle = document.createElement('div');
            particle.className = 'auth-particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 8 + 's';
            particle.style.animationDuration = (6 + Math.random() * 6) + 's';
            particle.style.width = (2 + Math.random() * 3) + 'px';
            particle.style.height = particle.style.width;
            container.appendChild(particle);
        }
    }

    /* -------- Auth Tab Switching -------- */
    function initAuthTabs() {
        const tabs = $$('.auth-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const target = tab.dataset.tab;
                $$('.auth-form').forEach(f => f.classList.remove('active'));
                $(`#${target}-form`).classList.add('active');
                hideAuthError();
            });
        });
    }

    function showAuthError(msg) {
        const el = $('#auth-error');
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    function hideAuthError() {
        const el = $('#auth-error');
        if (el) el.classList.add('hidden');
    }

    function setAuthLoading(btnId, loading) {
        const btn = $(`#${btnId}`);
        if (!btn) return;
        const span = btn.querySelector('span:first-child');
        const loader = btn.querySelector('.btn-loader');
        if (loading) {
            btn.disabled = true;
            if (span) span.style.display = 'none';
            if (loader) loader.classList.remove('hidden');
        } else {
            btn.disabled = false;
            if (span) span.style.display = '';
            if (loader) loader.classList.add('hidden');
        }
    }

    /* -------- Screen Switching -------- */
    function showApp() {
        $('#auth-screen').classList.add('hidden');
        $('#app').classList.remove('hidden');
    }

    function showAuth() {
        $('#auth-screen').classList.remove('hidden');
        $('#app').classList.add('hidden');
    }

    /* -------- Sidebar -------- */
    function toggleSidebar() {
        const sidebar = $('#sidebar');
        sidebarOpen = !sidebarOpen;
        if (sidebarOpen) {
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.add('collapsed');
        }
    }

    function closeSidebar() {
        sidebarOpen = false;
        $('#sidebar').classList.add('collapsed');
    }

    /* -------- User Info -------- */
    function updateUserInfo(user) {
        const initials = $('#user-initials');
        if (user && user.displayName) {
            const names = user.displayName.split(' ');
            initials.textContent = names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
        } else if (user && user.email) {
            initials.textContent = user.email[0].toUpperCase();
        } else {
            initials.textContent = 'G';
        }
    }

    /* -------- Model Indicator -------- */
    function updateModelIndicator(modelName) {
        const el = $('#current-model-name');
        if (el) el.textContent = modelName;
        
        const input = $('#chat-input');
        if (input) {
            input.placeholder = `Message ${modelName}...`;
        }
    }

    /* -------- Mode Toggles -------- */
    function setModeActive(btnId, active) {
        const btn = $(`#${btnId}`);
        if (!btn) return;
        if (active) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    /* -------- Chat List -------- */
    function renderChatList(chats, activeChatId, onSelect, onDelete, onRename) {
        const container = $('#chat-list');
        if (!container) return;
        container.innerHTML = '';

        // Sort chats by createdAt (newest first)
        const sortedChats = Object.entries(chats).sort((a, b) => {
            return (b[1].createdAt || 0) - (a[1].createdAt || 0);
        });

        if (sortedChats.length === 0) {
            container.innerHTML = '<p style="text-align:center;color:var(--text-dim);font-size:0.82rem;padding:20px;">No chats yet</p>';
            return;
        }

        sortedChats.forEach(([chatId, chat]) => {
            const isActive = chatId === activeChatId;
            const item = document.createElement('div');
            item.className = `chat-item${isActive ? ' active' : ''}`;
            item.dataset.chatId = chatId;

            item.innerHTML = `
                <span class="chat-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </span>
                <span class="chat-item-title">${escapeHtml(truncate(chat.title || 'New Chat', 28))}</span>
                <div class="chat-item-actions">
                    <button class="btn-icon rename-btn" title="Rename">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-icon delete-btn" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                </div>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.closest('.chat-item-actions')) {
                    onSelect(chatId);
                }
            });

            item.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const newTitle = prompt('Rename chat:', chat.title || 'New Chat');
                if (newTitle && newTitle.trim()) {
                    onRename(chatId, newTitle.trim());
                }
            });

            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) {
                    onDelete(chatId);
                }
            });

            container.appendChild(item);
        });
    }

    function filterChatList(searchTerm) {
        const items = $$('.chat-item');
        const term = searchTerm.toLowerCase().trim();
        items.forEach(item => {
            const title = item.querySelector('.chat-item-title').textContent.toLowerCase();
            item.style.display = !term || title.includes(term) ? '' : 'none';
        });
    }

    /* -------- Messages -------- */
    function showWelcome() {
        $('#welcome-screen').classList.remove('hidden');
        $('#messages-container').innerHTML = '';
    }

    function hideWelcome() {
        $('#welcome-screen').classList.add('hidden');
    }

    function renderMessages(messages) {
        const container = $('#messages-container');
        container.innerHTML = '';
        messages.forEach((msg, index) => {
            appendMessage(msg, index, false);
        });
        scrollToBottom();
    }

    function appendMessage(msg, index, scroll = true) {
        const container = $('#messages-container');
        hideWelcome();

        const msgEl = document.createElement('div');
        msgEl.className = `message ${msg.role}`;
        msgEl.dataset.index = index;

        const isUser = msg.role === 'user';
        const avatar = isUser ? '👤' : '✦';
        const senderName = isUser ? 'You' : (msg.modelName || 'LAURIXY AI');
        const timeStr = formatTime(msg.timestamp || new Date());

        let bodyContent = '';
        if (isUser) {
            bodyContent = `<p>${escapeHtml(msg.content)}</p>`;
        } else {
            // Check for thinking content
            let thinkingHtml = '';
            if (msg.thinking) {
                thinkingHtml = `
                    <div class="thinking-indicator" onclick="this.nextElementSibling.classList.toggle('open')">
                        <span>🧠</span>
                        <span>Thinking process</span>
                        <div class="thinking-dots"><span></span><span></span><span></span></div>
                    </div>
                    <div class="thinking-content">${renderMarkdown(msg.thinking)}</div>
                `;
            }

            // Check for image
            if (msg.imageUrl) {
                bodyContent = `${thinkingHtml}<img src="${escapeHtml(msg.imageUrl)}" alt="Generated Image" class="ai-image">`;
            } else {
                bodyContent = `${thinkingHtml}${renderMarkdown(msg.content)}`;
            }
        }

        msgEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${senderName}</span>
                    <span class="message-time">${timeStr}</span>
                </div>
                <div class="message-body">${bodyContent}</div>
                <div class="message-actions">
                    <button class="msg-action-btn" onclick="LaurixyApp.copyMessage(${index})" title="Copy">📋 Copy</button>
                    ${!isUser ? `<button class="msg-action-btn" onclick="LaurixyApp.readMessage(${index})" title="Read Aloud">🔊 Read</button>` : ''}
                    <button class="msg-action-btn" onclick="LaurixyApp.deleteMessage(${index})" title="Delete">🗑 Delete</button>
                    ${!isUser ? `<button class="msg-action-btn" onclick="LaurixyApp.regenerateMessage(${index})" title="Regenerate">🔁 Regenerate</button>` : ''}
                </div>
            </div>
        `;

        container.appendChild(msgEl);

        // Highlight code blocks
        msgEl.querySelectorAll('pre code').forEach(block => {
            Prism.highlightElement(block);
        });

        if (scroll) scrollToBottom();
    }

    function updateLastAssistantMessage(content, thinking = null) {
        const messages = $$('.message.assistant');
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        const body = last.querySelector('.message-body');
        if (!body) return;

        let thinkingHtml = '';
        if (thinking) {
            thinkingHtml = `
                <div class="thinking-indicator" onclick="this.nextElementSibling.classList.toggle('open')">
                    <span>🧠</span>
                    <span>Thinking process</span>
                </div>
                <div class="thinking-content">${renderMarkdown(thinking)}</div>
            `;
        }

        body.innerHTML = `${thinkingHtml}${renderMarkdown(content)}`;
        body.classList.add('streaming-cursor');

        // Highlight code
        body.querySelectorAll('pre code').forEach(block => {
            Prism.highlightElement(block);
        });

        scrollToBottom();
    }

    function finalizeLastAssistantMessage() {
        const messages = $$('.message.assistant');
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        const body = last.querySelector('.message-body');
        if (body) body.classList.remove('streaming-cursor');
    }

    function appendStreamingPlaceholder(index, modelName = 'LAURIXY AI') {
        const container = $('#messages-container');
        hideWelcome();

        const msgEl = document.createElement('div');
        msgEl.className = 'message assistant';
        msgEl.dataset.index = index;

        msgEl.innerHTML = `
            <div class="message-avatar">✦</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-sender">${escapeHtml(modelName)}</span>
                    <span class="message-time">${formatTime(new Date())}</span>
                </div>
                <div class="message-body streaming-cursor">
                    <div class="thinking-dots"><span></span><span></span><span></span></div>
                </div>
                <div class="message-actions">
                    <button class="msg-action-btn" onclick="LaurixyApp.copyMessage(${index})" title="Copy">📋 Copy</button>
                    <button class="msg-action-btn" onclick="LaurixyApp.readMessage(${index})" title="Read Aloud">🔊 Read</button>
                    <button class="msg-action-btn" onclick="LaurixyApp.deleteMessage(${index})" title="Delete">🗑 Delete</button>
                    <button class="msg-action-btn" onclick="LaurixyApp.regenerateMessage(${index})" title="Regenerate">🔁 Regenerate</button>
                </div>
            </div>
        `;

        container.appendChild(msgEl);
        scrollToBottom();
    }

    /* -------- Scrolling -------- */
    function scrollToBottom() {
        const chatArea = $('#chat-area');
        if (chatArea) {
            requestAnimationFrame(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            });
        }
    }

    /* -------- Send / Stop Button -------- */
    function setGenerating(generating) {
        const sendBtn = $('#btn-send');
        const stopBtn = $('#btn-stop');
        if (generating) {
            sendBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
        } else {
            sendBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        }
    }

    function setSendEnabled(enabled) {
        const btn = $('#btn-send');
        if (btn) btn.disabled = !enabled;
    }

    /* -------- Modals -------- */
    function showModal(id) {
        const el = $(`#${id}`);
        if (el) el.classList.remove('hidden');
    }

    function hideModal(id) {
        const el = $(`#${id}`);
        if (el) el.classList.add('hidden');
    }

    /* -------- Admin Toggle Visibility -------- */
    function setAdminVisible(visible) {
        const btn = $('#btn-admin');
        if (btn) btn.style.display = visible ? '' : 'none';
    }

    /* -------- Initialize -------- */
    function init() {
        initAuthParticles();
        initAuthTabs();

        // Auto-resize textarea
        const input = $('#chat-input');
        if (input) {
            input.addEventListener('input', () => {
                LaurixyUtils.autoResize(input);
                setSendEnabled(input.value.trim().length > 0);
            });
        }

        // Mobile: close sidebar by default
        if (window.innerWidth <= 768) {
            closeSidebar();
        }
    }

    /* -------- Public API -------- */
    return {
        init,
        showAuthError,
        hideAuthError,
        setAuthLoading,
        showApp,
        showAuth,
        toggleSidebar,
        closeSidebar,
        updateUserInfo,
        updateModelIndicator,
        setModeActive,
        renderChatList,
        filterChatList,
        showWelcome,
        hideWelcome,
        renderMessages,
        appendMessage,
        updateLastAssistantMessage,
        finalizeLastAssistantMessage,
        appendStreamingPlaceholder,
        scrollToBottom,
        setGenerating,
        setSendEnabled,
        showModal,
        hideModal,
        setAdminVisible
    };
})();
