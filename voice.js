/* ============================================================
   LAURIXY AI — VOICE MODULE
   Speech recognition & synthesis (Jarvis-style assistant)
   ============================================================ */

const LaurixyVoice = (() => {
    'use strict';

    const { $, showToast, getLocal, setLocal } = LaurixyUtils;

    /* -------- State -------- */
    let recognition = null;
    let synthesis = window.speechSynthesis;
    let isListening = false;
    let currentTranscript = '';
    let onResultCallback = null;

    /* -------- Settings -------- */
    function getSettings() {
        return {
            speed: getLocal('laurixy_voice_speed', 1),
            pitch: getLocal('laurixy_voice_pitch', 1),
            voiceReplies: getLocal('laurixy_voice_replies', false),
            language: getLocal('laurixy_voice_lang', 'en-US')
        };
    }

    function saveSettings(settings) {
        if (settings.speed !== undefined) setLocal('laurixy_voice_speed', settings.speed);
        if (settings.pitch !== undefined) setLocal('laurixy_voice_pitch', settings.pitch);
        if (settings.voiceReplies !== undefined) setLocal('laurixy_voice_replies', settings.voiceReplies);
        if (settings.language !== undefined) setLocal('laurixy_voice_lang', settings.language);
    }

    /* -------- Speech Recognition -------- */

    function initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('[Voice] Speech recognition not supported');
            return false;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = getSettings().language;

        recognition.onstart = () => {
            isListening = true;
            updateVoiceUI('Listening...', '');
        };

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (final) {
                currentTranscript += final;
            }

            updateVoiceUI('Listening...', currentTranscript + interim);
        };

        recognition.onerror = (event) => {
            console.error('[Voice] Recognition error:', event.error);
            if (event.error === 'not-allowed') {
                showToast('Microphone access denied', 'error');
            }
            stopListening();
        };

        recognition.onend = () => {
            isListening = false;
            if (currentTranscript.trim()) {
                updateVoiceUI('Ready to send', currentTranscript);
            } else {
                updateVoiceUI('No speech detected', '');
            }
        };

        return true;
    }

    function startListening() {
        currentTranscript = '';

        if (!recognition) {
            if (!initRecognition()) {
                showToast('Speech recognition not supported in this browser', 'error');
                return;
            }
        }

        // Update language
        recognition.lang = getSettings().language;

        try {
            recognition.start();
            showVoiceOverlay();
        } catch (e) {
            console.error('[Voice] Start error:', e);
            // If already started, restart
            recognition.stop();
            setTimeout(() => {
                try {
                    recognition.start();
                    showVoiceOverlay();
                } catch (e2) {
                    showToast('Could not start voice input', 'error');
                }
            }, 200);
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            try { recognition.stop(); } catch {}
        }
        isListening = false;
    }

    /* -------- Speech Synthesis -------- */

    function speak(text, force = false) {
        const settings = getSettings();
        if (!settings.voiceReplies && !force) return;
        if (!synthesis) return;

        // Cancel any ongoing speech
        synthesis.cancel();

        // Clean text (remove markdown, code blocks)
        let cleanText = text
            .replace(/```[\s\S]*?```/g, 'code block')
            .replace(/`[^`]*`/g, '')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/[#*_~]/g, '')
            .replace(/\n{2,}/g, '. ')
            .replace(/\n/g, ' ')
            .trim();

        if (!cleanText) return;

        // Limit length for speech
        if (cleanText.length > 500) {
            cleanText = cleanText.slice(0, 500) + '... I have provided the full response in text.';
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = settings.speed;
        utterance.pitch = settings.pitch;
        utterance.lang = settings.language;

        // Try to find a good voice
        const voices = synthesis.getVoices();
        const preferredVoice = voices.find(v =>
            v.lang.startsWith(settings.language.slice(0, 2)) && v.name.includes('Google')
        ) || voices.find(v =>
            v.lang.startsWith(settings.language.slice(0, 2))
        );

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        synthesis.speak(utterance);
    }

    function stopSpeaking() {
        if (synthesis) synthesis.cancel();
    }

    /* -------- Voice Overlay UI -------- */

    function showVoiceOverlay() {
        const overlay = $('#voice-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    function hideVoiceOverlay() {
        const overlay = $('#voice-overlay');
        if (overlay) overlay.classList.add('hidden');
        stopListening();
    }

    function updateVoiceUI(status, transcript) {
        const statusEl = $('#voice-status');
        const transcriptEl = $('#voice-transcript');
        if (statusEl) statusEl.textContent = status;
        if (transcriptEl) transcriptEl.textContent = transcript;
    }

    function getTranscript() {
        return currentTranscript.trim();
    }

    function setOnResult(callback) {
        onResultCallback = callback;
    }

    /* -------- Init Settings UI -------- */

    function initSettingsUI() {
        const settings = getSettings();

        const speedSlider = $('#voice-speed');
        const pitchSlider = $('#voice-pitch');
        const repliesToggle = $('#voice-replies-toggle');
        const langSelect = $('#speech-lang');
        const speedVal = $('#voice-speed-val');
        const pitchVal = $('#voice-pitch-val');

        if (speedSlider) {
            speedSlider.value = settings.speed;
            speedVal.textContent = settings.speed.toFixed(1);
            speedSlider.addEventListener('input', () => {
                const v = parseFloat(speedSlider.value);
                speedVal.textContent = v.toFixed(1);
                saveSettings({ speed: v });
            });
        }

        if (pitchSlider) {
            pitchSlider.value = settings.pitch;
            pitchVal.textContent = settings.pitch.toFixed(1);
            pitchSlider.addEventListener('input', () => {
                const v = parseFloat(pitchSlider.value);
                pitchVal.textContent = v.toFixed(1);
                saveSettings({ pitch: v });
            });
        }

        if (repliesToggle) {
            repliesToggle.checked = settings.voiceReplies;
            repliesToggle.addEventListener('change', () => {
                saveSettings({ voiceReplies: repliesToggle.checked });
            });
        }

        if (langSelect) {
            langSelect.value = settings.language;
            langSelect.addEventListener('change', () => {
                saveSettings({ language: langSelect.value });
            });
        }
    }

    /* -------- Public API -------- */
    return {
        startListening,
        stopListening,
        speak,
        stopSpeaking,
        showVoiceOverlay,
        hideVoiceOverlay,
        getTranscript,
        getSettings,
        saveSettings,
        initSettingsUI,
        setOnResult
    };
})();
