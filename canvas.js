/* ============================================================
   LAURIXY AI — CANVAS MODULE
   Code editor / workspace with live preview
   ============================================================ */

const LaurixyCanvas = (() => {
    'use strict';

    const { $, showToast, escapeHtml } = LaurixyUtils;

    /* -------- State -------- */
    let currentCode = '';
    let currentLang = 'javascript';

    /* -------- Open Canvas -------- */

    function openWithCode(code, lang) {
        currentCode = code || '';
        currentLang = lang || 'javascript';

        const editor = $('#canvas-editor');
        const langLabel = $('#canvas-lang');
        const overlay = $('#canvas-overlay');
        const previewWrap = $('#canvas-preview-wrap');

        if (editor) editor.value = currentCode;
        if (langLabel) langLabel.textContent = currentLang;
        if (previewWrap) previewWrap.classList.add('hidden');
        if (overlay) overlay.classList.remove('hidden');
    }

    function close() {
        const overlay = $('#canvas-overlay');
        if (overlay) overlay.classList.add('hidden');
        const preview = $('#canvas-preview');
        if (preview) preview.srcdoc = '';
    }

    /* -------- Copy Code -------- */

    function copyCode() {
        const editor = $('#canvas-editor');
        if (!editor) return;
        LaurixyUtils.copyToClipboard(editor.value);
        showToast('Code copied!', 'success');
    }

    /* -------- Download Code -------- */

    function downloadCode() {
        const editor = $('#canvas-editor');
        if (!editor) return;

        const extensions = {
            'javascript': 'js',
            'python': 'py',
            'html': 'html',
            'css': 'css',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'typescript': 'ts',
            'json': 'json',
            'bash': 'sh',
            'text': 'txt'
        };

        const ext = extensions[currentLang] || 'txt';
        const filename = `laurixy_code.${ext}`;
        LaurixyUtils.downloadFile(editor.value, filename, 'text/plain');
        showToast('File downloaded!', 'success');
    }

    /* -------- Live Preview -------- */

    function runPreview() {
        const editor = $('#canvas-editor');
        const previewWrap = $('#canvas-preview-wrap');
        const preview = $('#canvas-preview');
        if (!editor || !preview || !previewWrap) return;

        const code = editor.value;
        previewWrap.classList.remove('hidden');

        // Determine what to preview based on language
        if (currentLang === 'html' || code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
            // Render HTML directly
            preview.srcdoc = code;
        } else if (currentLang === 'javascript' || currentLang === 'js') {
            // Wrap JS in HTML
            preview.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { background: #1a1a2e; color: #e8eaf0; font-family: monospace; padding: 16px; }
                        .output { white-space: pre-wrap; }
                    </style>
                </head>
                <body>
                    <div class="output" id="output"></div>
                    <script>
                        const output = document.getElementById('output');
                        const origLog = console.log;
                        console.log = function(...args) {
                            output.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') + '\\n';
                            origLog.apply(console, args);
                        };
                        console.error = function(...args) {
                            output.innerHTML += '<span style="color:#ff3355">' + args.join(' ') + '</span>\\n';
                        };
                        try {
                            ${code}
                        } catch(e) {
                            console.error('Error: ' + e.message);
                        }
                    <\/script>
                </body>
                </html>
            `;
        } else if (currentLang === 'css') {
            preview.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head><style>${code}</style></head>
                <body>
                    <div style="padding:20px; font-family:sans-serif;">
                        <h1>CSS Preview</h1>
                        <p>This is a paragraph with your styles applied.</p>
                        <button>Button</button>
                        <div class="box" style="width:100px;height:100px;background:#333;margin:10px 0;"></div>
                        <ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>
                    </div>
                </body>
                </html>
            `;
        } else {
            // Show code as text for unsupported languages
            preview.srcdoc = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { background: #1a1a2e; color: #e8eaf0; font-family: monospace; padding: 16px; }
                    </style>
                </head>
                <body>
                    <p style="color: #8b8fa8;">Preview is only available for HTML, JavaScript, and CSS.</p>
                    <pre>${escapeHtml(code)}</pre>
                </body>
                </html>
            `;
        }

        showToast('Preview loaded', 'info');
    }

    /* -------- Init Event Listeners -------- */

    function init() {
        const btnCopy = $('#btn-canvas-copy');
        const btnDownload = $('#btn-canvas-download');
        const btnRun = $('#btn-canvas-run');
        const btnClose = $('#btn-canvas-close');

        if (btnCopy) btnCopy.addEventListener('click', copyCode);
        if (btnDownload) btnDownload.addEventListener('click', downloadCode);
        if (btnRun) btnRun.addEventListener('click', runPreview);
        if (btnClose) btnClose.addEventListener('click', close);
    }

    /* -------- Public API -------- */
    return {
        openWithCode,
        close,
        copyCode,
        downloadCode,
        runPreview,
        init
    };
})();
