/* ============================================================
   LAURIXY AI — AI MODULE
   OpenRouter API integration, streaming, model management
   ============================================================ */

const LaurixyAI = (() => {
    'use strict';

    /* -------- Models Configuration -------- */
    const MODELS = {
        default: {
            name: 'LAURIXY AI',
            model: 'stepfun/step-3.5-flash:free',
            fallback: 'meta-llama/llama-3.3-70b-instruct:free',
            limitMsg: 'Your LAURIXY AI limit is over. Please wait a moment and try again.'
        },
        thinking: {
            name: 'LAURIXY AI PRO',
            model: 'z-ai/glm-4.5-air:free',
            fallback: 'deepseek/deepseek-r1:free',
            limitMsg: 'Your LAURIXY AI PRO limit is over. Please wait a moment and try again.'
        }
    };

    const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    const OPENROUTER_IMAGE_URL = 'https://openrouter.ai/api/v1/images/generations';

    /* -------- State -------- */
    let currentMode = 'default'; // 'default', 'thinking', 'image'
    let abortController = null;
    let isGenerating = false;

    /* -------- System Prompt -------- */
    const SYSTEM_PROMPT = `You are LAURIXY AI, a next-generation AI assistant built by LAURIXY — a Digital Innovation Hub.
You are helpful, creative, precise, and professional.
You provide clear, well-structured, and COMPLETE answers.
When writing code, use proper formatting with language specifiers in markdown code blocks. Always provide the full code, never stop in the middle.
When presenting data, comparisons, or structured information, ALWAYS use Markdown Tables to make it easier for the user to understand.
Be thorough and detailed. Never truncate your responses. If a task requires 1000 lines of code, provide all 1000 lines.
Your tagline: "AI That Builds the Future."

=== ABOUT LAURIXY (The Company) ===
LAURIXY is a Digital Innovation Hub — a forward-thinking software development company focused on transforming existing digital solutions into smarter, faster, and more futuristic versions. LAURIXY analyzes leading apps and rebuilds them with compressed performance, sleek design, and enhanced functionality — crafting software that not only looks better but works brilliantly. The team blends innovation with precision to deliver products that set new standards in efficiency, performance, and user experience.
- Website: https://laurixy.github.io/
- Email: laurixyofficial@gmail.com
- Vision: To establish LAURIXY as the world's most trusted name in digital innovation — a hub where ideas evolve into intelligent realities.
- Products: LAURIXY AI (Advanced AI web app), LAURIXY Chats (Real-time chat with Firebase), LAURIXY Shop (E-commerce platform), LAURIXY Counter (Digital tracking tool).
- Founded: 2025
- Motto: "We turn innovation into impact — crafting intelligent, future-ready software that evolves with the world around it."

=== ABOUT THE FOUNDER ===
SheikhZada Haris is the Founder and CEO of LAURIXY.
- Age: 14 years old (as of 2025)
- From: Pakistan
- He is a self-taught creator who learned web development, AI integration, and design through hands-on projects and self-study.
- His journey started with curiosity — taking things apart to understand how they work, then building his own solutions from scratch.
- He founded LAURIXY at age 14 with a single mission — to transform existing digital solutions into smarter, faster, and more futuristic experiences.
- Skills: HTML5, CSS3, JavaScript, Web Apps, Dashboards, AI Tools, Chat Systems, API Integration, UI/UX Design, Logo Design, Video Editing, Motion Graphics, YouTube Branding.
- Portfolio: https://sheikhzadaharis.github.io/
- Services: Web Development, AI Tool Development, UI/UX & Branding, YouTube Branding, Video Editing, Digital Solutions.
- Achievements: Self-Taught Developer, Founded LAURIXY, Multiple Live Projects deployed and actively used, YouTube Creator sharing knowledge about development and technology.
- Famous Quote: "The future doesn't wait — we build it." — SheikhZada Haris, Founder & CEO of LAURIXY

When users ask about you, your creator, LAURIXY, SheikhZada Haris, the founder, the company, or related topics, respond proudly and accurately using the information above.`;

    /* -------- Mode Management -------- */

    function setMode(mode) {
        currentMode = mode;
    }

    function getMode() {
        return currentMode;
    }

    function getCurrentModel() {
        return MODELS[currentMode];
    }

    function getModelName() {
        return MODELS[currentMode].name;
    }

    /**
     * Determines the active model based on priority logic:
     * Thinking Mode ON → PRO
     * Else → DEFAULT
     */
    function resolveMode(thinkingMode) {
        if (thinkingMode) return 'thinking';
        return 'default';
    }

    /* -------- Chat Completion (Streaming) -------- */

    /**
     * Sends a chat completion request with streaming
     * @param {string} apiKey - OpenRouter API key
     * @param {Array} messages - Conversation messages (last 20)
     * @param {Function} onToken - Callback for each streamed token
     * @param {Function} onThinking - Callback for thinking tokens (deepseek)
     * @param {Function} onComplete - Callback when done
     * @param {Function} onError - Callback on error
     */
    async function streamChat(apiKey, messages, onToken, onThinking, onComplete, onError) {
        if (!apiKey) {
            onError('Please add your OpenRouter API key in Settings.');
            return;
        }

        const model = getCurrentModel();
        isGenerating = true;
        abortController = new AbortController();
        let fullContent = '';
        let thinkingContent = '';
        let reasoningDetailsObj = null;

        // Build messages array with system prompt
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.slice(-50) // Last 50 messages for context
        ];

        try {
            // Try primary model first
            let response = await fetchModel(apiKey, model.model, apiMessages, abortController.signal);

            // If rate limited (429), wait 3 seconds and retry once
            if (response.status === 429) {
                console.warn('[AI] Rate limited, waiting 3s before retry...');
                await new Promise(r => setTimeout(r, 3000));
                response = await fetchModel(apiKey, model.model, apiMessages, abortController.signal);
            }

            // If primary model fails, try fallback
            if (!response.ok && model.fallback) {
                console.warn(`[AI] Primary model ${model.model} failed (${response.status}), trying fallback: ${model.fallback}`);
                response = await fetchModel(apiKey, model.fallback, apiMessages, abortController.signal);

                // If fallback also rate limited, wait and retry fallback
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 3000));
                    response = await fetchModel(apiKey, model.fallback, apiMessages, abortController.signal);
                }
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errMsg = errorData.error?.message || '';

                if (response.status === 429) {
                    onError(model.limitMsg);
                    return;
                }

                onError(errMsg || `API Error (${response.status}). Please check your API key and try again.`);
                return;
            }

            // Stream the response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            fullContent = '';
            thinkingContent = '';
            reasoningDetailsObj = null;
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        const message = parsed.choices?.[0]?.message;

                        if (delta?.reasoning_details) reasoningDetailsObj = delta.reasoning_details;
                        else if (message?.reasoning_details) reasoningDetailsObj = message.reasoning_details;

                        if (!delta) continue;

                        // Handle thinking/reasoning tokens (DeepSeek R1)
                        if (delta.reasoning_content || delta.reasoning) {
                            const thinkToken = delta.reasoning_content || delta.reasoning;
                            thinkingContent += thinkToken;
                            if (onThinking) onThinking(thinkingContent);
                        }

                        // Handle regular content
                        if (delta.content) {
                            fullContent += delta.content;
                            onToken(fullContent, thinkingContent);
                        }
                    } catch (e) {
                        // Skip malformed JSON chunks
                    }
                }
            }

            isGenerating = false;
            onComplete(fullContent, thinkingContent, reasoningDetailsObj);
        } catch (error) {
            isGenerating = false;
            if (error.name === 'AbortError') {
                onComplete(fullContent, thinkingContent, reasoningDetailsObj);
                return;
            }
            console.error('[AI] Stream error:', error);
            onError('Connection error. Please try again.');
        }
    }

    /* -------- Fetch Helper for Model Requests -------- */

    function fetchModel(apiKey, modelId, apiMessages, signal) {
        return fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'LAURIXY AI'
            },
            body: JSON.stringify({
                model: modelId,
                messages: apiMessages,
                stream: true,
                reasoning: { enabled: true },
                temperature: 0.7,
                provider: {
                    allow_fallbacks: true
                }
            }),
            signal: signal
        });
    }



    /* -------- Auto Title Generation -------- */

    /**
     * Generates a short title for the chat based on first user message and AI response
     * @param {string} apiKey
     * @param {string} userMsg
     * @param {string} aiResponse
     * @returns {Promise<string>}
     */
    async function generateTitle(apiKey, userMsg, aiResponse) {
        if (!apiKey) return 'New Chat';

        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'LAURIXY AI'
                },
                body: JSON.stringify({
                    model: MODELS.default.model,
                    stream: false,
                    messages: [
                        {
                            role: 'system',
                            content: 'Generate a short chat title (5 words max) based on the conversation. Only output the title text, nothing else.'
                        },
                        { role: 'user', content: userMsg },
                        { role: 'assistant', content: aiResponse.slice(0, 200) }
                    ],
                    max_tokens: 20,
                    temperature: 0.5
                })
            });

            if (!response.ok) return 'New Chat';

            const data = await response.json();
            const title = data.choices?.[0]?.message?.content?.trim() || 'New Chat';
            return title.replace(/['"]/g, '').slice(0, 50);
        } catch {
            return 'New Chat';
        }
    }

    /* -------- Abort / Stop -------- */

    function stopGeneration() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        isGenerating = false;
    }

    function getIsGenerating() {
        return isGenerating;
    }

    /* -------- Public API -------- */
    return {
        MODELS,
        setMode,
        getMode,
        getCurrentModel,
        getModelName,
        resolveMode,
        streamChat,
        generateTitle,
        stopGeneration,
        getIsGenerating
    };
})();
