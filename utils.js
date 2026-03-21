/* ============================================================
   LAURIXY AI — UTILITIES MODULE
   Shared helper functions: sanitization, formatting, DOM, etc.
   ============================================================ */

const LaurixyUtils = (() => {
    'use strict';

    /* -------- HTML Escaping & XSS Protection -------- */

    /**
     * Escapes HTML entities to prevent XSS
     * @param {string} str - Raw string
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (!str) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;',
            '`': '&#x60;'
        };
        return String(str).replace(/[&<>"'\/`]/g, (s) => map[s]);
    }

    /**
     * Sanitizes markdown output — strips dangerous script tags
     * but preserves code blocks
     * @param {string} html - Raw HTML from marked
     * @returns {string} Sanitized HTML
     */
    function sanitizeHtml(html) {
        if (!html) return '';
        // Remove script tags and event handlers
        let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        clean = clean.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        clean = clean.replace(/javascript\s*:/gi, '');
        clean = clean.replace(/<iframe\b[^>]*>/gi, '');
        return clean;
    }

    /* -------- Markdown Rendering -------- */

    /**
     * Configures and returns rendered markdown
     * @param {string} text - Raw markdown text
     * @returns {string} Rendered HTML
     */
    function renderMarkdown(text) {
        if (!text) return '';

        // Configure marked with security
        marked.setOptions({
            breaks: true,
            gfm: true,
            sanitize: false // We handle sanitization separately
        });

        let html = marked.parse(text);
        html = sanitizeHtml(html);

        // Wrap code blocks with header (language + copy/canvas buttons)
        html = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
            (match, lang, code) => {
                const id = generateId('code');
                return `<pre>
                    <div class="code-header">
                        <span class="code-lang">${escapeHtml(lang)}</span>
                        <div class="code-actions">
                            <button class="code-action-btn" onclick="LaurixyUtils.copyCode('${id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>
                            <button class="code-action-btn" onclick="LaurixyCanvas.openWithCode(document.getElementById('${id}').textContent, '${escapeHtml(lang)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Canvas</button>
                        </div>
                    </div>
                    <code class="language-${escapeHtml(lang)}" id="${id}">${code}</code>
                </pre>`;
            }
        );

        // Also handle code blocks without specified language
        html = html.replace(/<pre><code(?!\s+class="language-)([\s\S]*?)>([\s\S]*?)<\/code><\/pre>/g,
            (match, attrs, code) => {
                const id = generateId('code');
                return `<pre>
                    <div class="code-header">
                        <span class="code-lang">code</span>
                        <div class="code-actions">
                            <button class="code-action-btn" onclick="LaurixyUtils.copyCode('${id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>
                            <button class="code-action-btn" onclick="LaurixyCanvas.openWithCode(document.getElementById('${id}').textContent, 'text')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> Canvas</button>
                        </div>
                    </div>
                    <code id="${id}">${code}</code>
                </pre>`;
            }
        );

        return html;
    }

    /* -------- Copy Code -------- */

    function copyCode(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const text = el.textContent;
        copyToClipboard(text);
        showToast('Code copied!', 'success');
    }

    /* -------- Clipboard -------- */

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    }

    /* -------- ID Generation -------- */

    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    /* -------- Date Formatting -------- */

    function formatTime(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(date) {
        if (!date) return '';
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diff = now - d;
        const dayMs = 86400000;

        if (diff < dayMs) return 'Today';
        if (diff < dayMs * 2) return 'Yesterday';
        if (diff < dayMs * 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /* -------- Toast Notifications -------- */

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>',
            error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff3355" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00aaff" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
        };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span style="display:flex;align-items:center">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 4200);
    }

    /* -------- DOM Helpers -------- */

    function $(selector) { return document.querySelector(selector); }
    function $$(selector) { return document.querySelectorAll(selector); }

    function createElement(tag, className, innerHTML) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    }

    /* -------- Debounce -------- */

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /* -------- Local Storage Helpers -------- */

    function getLocal(key, fallback = null) {
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : fallback;
        } catch {
            return fallback;
        }
    }

    function setLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('LocalStorage write failed:', e);
        }
    }

    function removeLocal(key) {
        try {
            localStorage.removeItem(key);
        } catch {}
    }

    /* -------- Chat Export Helpers -------- */

    function exportAsTxt(messages, title) {
        let text = `=== ${title || 'LAURIXY AI Chat'} ===\n\n`;
        messages.forEach(msg => {
            const role = msg.role === 'user' ? 'You' : 'LAURIXY AI';
            text += `[${role}] ${formatTime(msg.timestamp)}\n${msg.content}\n\n`;
        });
        downloadFile(text, `${title || 'chat'}.txt`, 'text/plain');
    }

    function exportAsJson(messages, title) {
        const data = {
            title: title || 'LAURIXY AI Chat',
            exported: new Date().toISOString(),
            messages: messages
        };
        downloadFile(JSON.stringify(data, null, 2), `${title || 'chat'}.json`, 'application/json');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* -------- Auto-resize Textarea -------- */

    /* -------- Platform Detection -------- */
    function isAndroid() {
        return /Android/i.test(navigator.userAgent);
    }

    function isWebView() {
        const ua = navigator.userAgent.toLowerCase();
        // Common strings in mobile WebViews (APKs)
        return ua.includes('wv') || ua.includes('crosswalk') || (ua.includes('android') && ua.includes('version/'));
    }

    function autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    /* -------- Truncate Text -------- */

    function truncate(str, maxLen = 30) {
        if (!str) return '';
        return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
    }

    /* -------- Public API -------- */
    return {
        escapeHtml,
        sanitizeHtml,
        renderMarkdown,
        copyCode,
        copyToClipboard,
        generateId,
        formatTime,
        formatDate,
        showToast,
        $,
        $$,
        createElement,
        debounce,
        getLocal,
        setLocal,
        removeLocal,
        exportAsTxt,
        exportAsJson,
        downloadFile,
        autoResize,
        truncate,
        isAndroid,
        isWebView
    };
})();
