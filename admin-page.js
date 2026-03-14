/* ============================================================
   LAURIXY AI — ADMIN PAGE MODULE
   Separate dashboard logic for controlling the platform
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const { $, $$, showToast, formatTime, escapeHtml, renderMarkdown } = LaurixyUtils;

    let adminLogsInterval;
    let chatsData = {};
    let usersData = {};

    /* -------- Init & Auth Check -------- */
    LaurixyFirebase.init();

    LaurixyFirebase.onAuthStateChanged(async (user) => {
        if (!user) {
            window.location.href = 'index.html'; // Not logged in
            return;
        }

        const isAdmin = await LaurixyFirebase.isAdmin();
        if (!isAdmin) {
            alert('Access Denied. You do not have admin permissions.');
            window.location.href = 'index.html';
            return;
        }

        // Setup Admin Info
        $('#admin-loading').style.display = 'none';
        const initials = user.displayName ? user.displayName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : 'A';
        $('#admin-initials').textContent = initials;

        initAdminUI();
        loadDashboardStats();
    });

    /* -------- Navigation -------- */
    function initAdminUI() {
        // Sidebar nav
        $$('.admin-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                $$('.admin-nav-item').forEach(nav => nav.classList.remove('active'));
                $$('.admin-section').forEach(sec => sec.classList.remove('active'));

                item.classList.add('active');
                const targetId = item.dataset.target;
                $(`#${targetId}`).classList.add('active');

                // Page Title
                $('#admin-page-title').textContent = item.textContent.replace(/[^\w\s&]/gi, '').trim();

                // Load view specific data
                if (targetId === 'dashboard') loadDashboardStats();
                if (targetId === 'users') loadUsersList();
                if (targetId === 'chats') loadChatsInspector();
                if (targetId === 'settings') loadGlobalSettings();
            });
        });

        // Settings Save button
        $('#btn-save-global-settings').addEventListener('click', saveGlobalSettings);

        // Clear Logs button
        const btnClearLogs = $('#btn-clear-logs');
        if (btnClearLogs) {
            btnClearLogs.addEventListener('click', async () => {
                if (!confirm('Are you sure you want to delete ALL system logs? This cannot be undone.')) return;
                const result = await LaurixyFirebase.clearSystemLogs();
                if (result.success) {
                    showToast('System logs cleared.', 'success');
                    refreshLogs();
                } else {
                    showToast('Failed to clear logs.', 'error');
                }
            });
        }

        // Clear All Chats button
        const btnClearAllChats = $('#btn-clear-all-chats');
        if (btnClearAllChats) {
            btnClearAllChats.addEventListener('click', async () => {
                if (!confirm('CRITICAL: This will permanently delete EVERY user chat on the platform. Are you absolutely sure?')) return;
                if (!confirm('FINAL WARNING: This cannot be undone. All user chat history will be lost. Proceed?')) return;
                
                const result = await LaurixyFirebase.clearAllChatsAdmin();
                if (result.success) {
                    showToast('All platform chats deleted.', 'success');
                    chatsData = {};
                    if ($('#inspector-list')) $('#inspector-list').innerHTML = '';
                    if ($('#inspector-messages')) $('#inspector-messages').innerHTML = '';
                } else {
                    showToast('Failed to wipe chats.', 'error');
                }
            });
        }

        // Mobile Sidebar
        const sidebar = $('.admin-sidebar');
        const overlay = $('#sidebar-overlay');
        const openBtn = $('#btn-sidebar-open');

        function toggleSidebar(show) {
            if (show) {
                sidebar.classList.add('open');
                overlay.classList.add('open');
            } else {
                sidebar.classList.remove('open');
                overlay.classList.remove('open');
            }
        }

        if (openBtn) openBtn.onclick = () => toggleSidebar(true);
        if (overlay) overlay.onclick = () => toggleSidebar(false);

        // Close when clicking nav on mobile
        $$('.admin-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) toggleSidebar(false);
            });
        });

        // User Search Listener
        const userSearch = $('#user-search');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase().trim();
                filterUsers(term);
            });
        }
    }

    /* -------- Dashboard View -------- */
    async function loadDashboardStats() {
        const stats = await LaurixyFirebase.getAdminStats();
        if (!stats) return;

        const grid = $('#admin-stats-grid');
        grid.innerHTML = `
            <div class="stat-card glass-panel">
                <span class="stat-icon">👥</span>
                <div class="stat-info">
                    <span class="stat-value">${stats.totalUsers}</span>
                    <span class="stat-label">Total Users</span>
                </div>
            </div>
            <div class="stat-card glass-panel">
                <span class="stat-icon">💬</span>
                <div class="stat-info">
                    <span class="stat-value">${stats.totalChats}</span>
                    <span class="stat-label">Total Chats</span>
                </div>
            </div>
            <div class="stat-card glass-panel">
                <span class="stat-icon">🤖</span>
                <div class="stat-info">
                    <span class="stat-value">${stats.totalMessages}</span>
                    <span class="stat-label">AI Messages</span>
                </div>
            </div>
            <div class="stat-card glass-panel">
                <span class="stat-icon">🟢</span>
                <div class="stat-info">
                    <span class="stat-value">Online</span>
                    <span class="stat-label">System Status</span>
                </div>
            </div>
        `;

        refreshLogs();
        if (adminLogsInterval) clearInterval(adminLogsInterval);
        adminLogsInterval = setInterval(refreshLogs, 10000);
    }

    async function refreshLogs() {
        const logs = await LaurixyFirebase.getSystemLogs(20);
        const logList = $('#admin-logs-list');
        if (logs.length === 0) {
            logList.innerHTML = '<p class="text-dim">No logs available.</p>';
        } else {
            logList.innerHTML = logs.map(log => `
                <div class="log-entry" style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem; display: flex; gap: 12px;">
                    <span style="color:var(--text-dim); min-width: 80px;">${formatTime(log.timestamp)}</span>
                    <span style="color:var(--text-secondary);">${escapeHtml(log.message)}</span>
                </div>
            `).join('');
        }
    }

    /* -------- Users View -------- */
    async function loadUsersList() {
        usersData = await LaurixyFirebase.getAllUsers() || {};
        renderUsersTable(usersData);
    }

    function renderUsersTable(data) {
        const tbody = $('#users-table-body');
        const uids = Object.keys(data);
        
        if (uids.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-dim">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        uids.forEach(uid => {
            const user = data[uid].profile || {};
            const isBlocked = user.isBlocked === true;
            const isAdmin = user.isAdmin === true;

            let statusBadge = '';
            if (isAdmin) statusBadge = '<span class="badge admin">Admin</span>';
            else if (isBlocked) statusBadge = '<span class="badge blocked">Blocked</span>';
            else statusBadge = '<span class="badge user">Active</span>';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${uid}</td>
                <td style="font-weight: 500;">${escapeHtml(user.displayName || 'Unknown')}</td>
                <td>${escapeHtml(user.email || 'No email')}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--neon-blue); font-weight: bold;">
                    ${user.recoveryKey ? escapeHtml(user.recoveryKey) : '<span style="opacity:0.3">No Record</span>'}
                </td>
                <td style="font-size: 0.8rem;">${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-flex">
                        ${!isAdmin ? `
                            <button class="btn btn-sm ${isBlocked ? 'btn-secondary' : 'btn-primary'}" onclick="window.toggleUserBlock('${uid}', ${!isBlocked})">
                                ${isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button class="btn btn-sm btn-secondary" style="color:var(--neon-red); border-color: rgba(255,51,85,0.3);" onclick="window.deleteUser('${uid}')">Wipe</button>
                        ` : '<span class="text-dim" style="font-size:0.8rem;">Protected</span>'}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function filterUsers(term) {
        if (!term) {
            renderUsersTable(usersData);
            return;
        }
        const filtered = {};
        Object.keys(usersData).forEach(uid => {
            const user = usersData[uid].profile || {};
            const name = (user.displayName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            if (name.includes(term) || email.includes(term) || uid.toLowerCase().includes(term)) {
                filtered[uid] = usersData[uid];
            }
        });
        renderUsersTable(filtered);
    }

    window.toggleUserBlock = async (uid, blockStatus) => {
        if (!confirm(`Are you sure you want to ${blockStatus ? 'block' : 'unblock'} this user?`)) return;
        await LaurixyFirebase.setUserBlocked(uid, blockStatus);
        showToast(`User ${blockStatus ? 'blocked' : 'unblocked'} successfully.`, 'success');
        loadUsersList(); // Refresh
    };

    window.deleteUser = async (uid) => {
        if (!confirm('WARNING: This will permanently delete ALL data (profile, chats, settings) for this user. Continue?')) return;
        if (!confirm('ARE YOU ABSOLUTELY SURE? This cannot be undone.')) return;
        
        await LaurixyFirebase.deleteUserData(uid);
        showToast('User data wiped permanently.', 'success');
        loadUsersList(); // Refresh
    };

    /* -------- Chat Inspector View -------- */
    async function loadChatsInspector() {
        const listEl = $('#inspector-list');
        listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);">Loading all chats...</div>';
        
        chatsData = await LaurixyFirebase.getAllChatsAdmin() || {};
        if (!usersData || Object.keys(usersData).length === 0) {
            usersData = await LaurixyFirebase.getAllUsers() || {};
        }

        listEl.innerHTML = '';
        let hasChats = false;

        Object.keys(chatsData).forEach(uid => {
            const userChats = chatsData[uid];
            const userName = usersData[uid] ? usersData[uid].profile.displayName : uid;

            // Add user header
            const header = document.createElement('div');
            header.style.cssText = 'padding: 10px 16px; background: rgba(0,0,0,0.6); font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); sticky: top;';
            header.textContent = `User: ${userName}`;
            listEl.appendChild(header);

            Object.keys(userChats).forEach(chatId => {
                hasChats = true;
                const chat = userChats[chatId];
                const item = document.createElement('div');
                item.className = 'inspector-chat-item';
                item.innerHTML = `
                    <div style="font-weight: 500; font-size: 0.9rem; margin-bottom: 4px;">${escapeHtml(LaurixyUtils.truncate(chat.title || 'Untitled', 25))}</div>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${formatTime(chat.createdAt || Date.now())} • ${chat.messages ? chat.messages.length : 0} msgs</div>
                `;
                item.onclick = () => {
                    $$('.inspector-chat-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    viewChatDetails(uid, chatId, chat, userName);
                };
                listEl.appendChild(item);
            });
        });

        if (!hasChats) {
            listEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);">No chats found on platform.</div>';
        }
    }

    function viewChatDetails(uid, chatId, chat, userName) {
        $('#inspector-chat-title').textContent = chat.title || 'Untitled Chat';
        $('#inspector-chat-meta').textContent = `Owner: ${userName} | ID: ${chatId} | Messages: ${chat.messages ? chat.messages.length : 0}`;
        
        const container = $('#inspector-messages');
        container.innerHTML = '';

        if (!chat.messages || chat.messages.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-dim); padding:40px;">No messages in this chat.</div>';
            return;
        }

        chat.messages.forEach(msg => {
            const el = document.createElement('div');
            const isUser = msg.role === 'user';
            
            el.className = `inspector-msg ${msg.role}`;
            
            let content = escapeHtml(msg.content);
            if (!isUser && msg.imageUrl) {
                content = `<img src="${escapeHtml(msg.imageUrl)}" style="max-width: 100%; border-radius: 8px;">`;
            } else if (!isUser) {
                // Render markdown for assistant but limit complexity
                content = renderMarkdown(msg.content);
            }

            el.innerHTML = `
                <div style="font-size: 0.75rem; color: var(${isUser ? '--neon-blue' : '--neon-purple'}); margin-bottom: 6px; display:flex; justify-content:space-between;">
                    <span>${isUser ? userName : (msg.modelName || 'LAURIXY AI')}</span>
                    <span style="opacity:0.6">${formatTime(msg.timestamp || Date.now())}</span>
                </div>
                <div>${content}</div>
            `;
            container.appendChild(el);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    /* -------- Settings View -------- */
    async function loadGlobalSettings() {
        const settings = await LaurixyFirebase.getGlobalSettings();
        $('#toggle-force-api').checked = settings.forceApi === true;
        $('#input-global-api').value = settings.globalApiKey || '';
    }

    async function saveGlobalSettings() {
        const forceApi = $('#toggle-force-api').checked;
        const globalApiKey = $('#input-global-api').value.trim();

        if (forceApi && !globalApiKey) {
            showToast('Cannot enable forced API without entering a Master API Key.', 'error');
            return;
        }

        const btn = $('#btn-save-global-settings');
        btn.textContent = 'Saving...';
        btn.disabled = true;

        await LaurixyFirebase.setGlobalSettings({
            forceApi: forceApi,
            globalApiKey: globalApiKey
        });

        showToast('Global settings applied to all users.', 'success');
        
        setTimeout(() => {
            btn.textContent = 'Save Settings';
            btn.disabled = false;
        }, 1000);
    }

});
