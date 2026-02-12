export interface DiscoveredModel {
    id: string;
    name: string;
    hasThinking: boolean;
    version: number;
}

export interface KeySupport {
    isValid: boolean;
    discoveredModels?: DiscoveredModel[];
    error?: string;
}

/**
 * Verify Google API key and discover available models.
 */
export async function verifyGoogleKey(apiKey: string): Promise<KeySupport> {
    if (!apiKey || apiKey.length < 30) return { isValid: false, error: "Malformed Key" };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            const err = await response.json();
            return { isValid: false, error: err.error?.message || "Invalid Key" };
        }

        const data = await response.json();
        const rawModels = data.models || [];

        const discoveredModels: DiscoveredModel[] = rawModels
            .filter((m: any) => {
                const id = m.name.replace('models/', '').toLowerCase();
                const displayName = m.displayName.toLowerCase();

                if (!m.supportedGenerationMethods.includes('generateContent')) return false;

                const noise = [
                    'lite', '00', 'vision', 'speech', 'embed', 'aqa', 'search', 'retrieval',
                    'nano', 'banana', '327b', 'robotics', 'computer', 'tts', 'experimental',
                    'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug',
                    '2025', '2026'
                ];
                if (noise.some(kw => id.includes(kw) || displayName.includes(kw))) return false;

                const whitelist = ['pro', 'flash', 'preview', 'think', 'deep', 'reasoner'];
                return whitelist.some(kw => id.includes(kw) || displayName.includes(kw));
            })
            .map((m: any) => {
                const id = m.name.replace('models/', '');
                const label = m.displayName;

                const supportsThinking =
                    id.includes('thinking') ||
                    id.includes('reasoner') ||
                    id.includes('think') ||
                    id.includes('deep') ||
                    id.includes('gemini-2.5') ||
                    id.includes('gemini-3');

                return {
                    id,
                    name: label,
                    hasThinking: supportsThinking,
                    version: id.includes('2.0') ? 2 : (id.includes('2.5') ? 2.5 : (id.includes('3.0') || id.includes('gemini-3') ? 3 : (id.includes('1.5') ? 1.5 : 1)))
                };
            });

        return { isValid: true, discoveredModels };
    } catch (error: any) {
        console.error("Google key verification failed:", error);
        return { isValid: false, error: error.message || "Network Error" };
    }
}

/**
 * Verify OpenAI API key and discover available models.
 */
export async function verifyOpenAIKey(apiKey: string): Promise<KeySupport> {
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 30) {
        return { isValid: false, error: "Malformed Key" };
    }

    try {
        // 1. Dry-run generation to check Billing/Quota status
        const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            })
        });

        if (!testResponse.ok) {
            const err = await testResponse.json().catch(() => ({}));
            return { isValid: false, error: err.error?.message || "Quota exceeded or billing issue" };
        }

        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { isValid: false, error: err.error?.message || "Invalid Key" };
        }

        const data = await response.json();
        const rawModels = data.data || [];

        // Filter for chat models
        // Filter for chat models and clean up list
        const discoveredModels: DiscoveredModel[] = rawModels
            .filter((m: any) => {
                const id = m.id.toLowerCase();

                // Exclude specific date snapshots to keep list clean (e.g. gpt-4-0125-preview)
                // We typically only want the main alias (e.g. gpt-4-turbo)
                const isSnapshot = /\d{4}|-\d{4}-/.test(id);

                // Keep mainstream modern models
                const isMainstream = (
                    id.includes('gpt-4') ||
                    id.startsWith('o1') ||
                    id.startsWith('o3')
                );

                return isMainstream &&
                    !isSnapshot &&
                    !id.includes('vision') &&
                    !id.includes('audio') &&
                    !id.includes('realtime') &&
                    !id.includes('transcribe') &&
                    !id.includes('tts') &&
                    !id.includes('search') &&
                    !id.includes('nano') &&
                    !id.includes('diarize');
            })
            .map((m: any) => {
                const id = m.id;

                // Better naming
                let name = id;
                if (id === 'gpt-4o') name = 'GPT-4o';
                else if (id === 'gpt-4-turbo') name = 'GPT-4 Turbo';
                else if (id === 'gpt-4') name = 'GPT-4 Classic';
                else if (id === 'o1') name = 'o1';
                else if (id === 'o1-mini') name = 'o1 Mini';
                else if (id === 'o1-preview') name = 'o1 Preview';
                else if (id === 'o3-mini') name = 'o3 Mini';
                else if (id.startsWith('o1')) name = `o1 (${id.replace('o1-', '')})`;
                else if (id.startsWith('o3')) name = `o3 (${id.replace('o3-', '')})`;
                else name = id; // Fallback

                // Determine if thinking
                const hasThinking = id.startsWith('o1') || id.startsWith('o3');

                return {
                    id,
                    name,
                    hasThinking,
                    version: id.startsWith('o1') || id.startsWith('o3') ? 5 : 4
                };
            })
            .sort((a: DiscoveredModel, b: DiscoveredModel) => b.version - a.version); // Sort newer first

        return { isValid: true, discoveredModels };
    } catch (error: any) {
        console.error("OpenAI key verification failed:", error);
        return { isValid: false, error: error.message || "Network Error" };
    }
}

/**
 * Verify Anthropic API key and discover available models.
 */
export async function verifyAnthropicKey(apiKey: string): Promise<KeySupport> {
    if (!apiKey || !apiKey.startsWith('sk-ant') || apiKey.length < 30) {
        return { isValid: false, error: "Malformed Key" };
    }

    try {
        // Anthropic doesn't have a models list endpoint, so we make a minimal request to verify the key
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        });

        // Even if we get a response (or rate limit), the key format is valid
        // 401 means invalid key, everything else means valid key
        if (response.status === 401) {
            return { isValid: false, error: "Invalid Key" };
        }

        // Anthropic models are well-known, return the current lineup
        const discoveredModels: DiscoveredModel[] = [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', hasThinking: true, version: 4 },
            { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', hasThinking: true, version: 3.7 },
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', hasThinking: false, version: 3.5 },
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', hasThinking: false, version: 3.5 },
            { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', hasThinking: false, version: 3 },
        ];

        return { isValid: true, discoveredModels };
    } catch (error: any) {
        console.error("Anthropic key verification failed:", error);
        return { isValid: false, error: error.message || "Network Error" };
    }
}

/**
 * Verify DeepSeek API key and discover available models.
 */
export async function verifyDeepSeekKey(apiKey: string): Promise<KeySupport> {
    if (!apiKey || !apiKey.startsWith('sk-') || apiKey.length < 20) {
        return { isValid: false, error: "Malformed Key" };
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { isValid: false, error: err.error?.message || "Invalid Key" };
        }

        const data = await response.json();
        const rawModels = data.data || [];

        const discoveredModels: DiscoveredModel[] = rawModels
            .filter((m: any) => {
                const id = m.id.toLowerCase();
                return id.includes('deepseek') && !id.includes('coder');
            })
            .map((m: any) => {
                const id = m.id;
                const hasThinking = id.includes('reasoner') || id.includes('think');
                return {
                    id,
                    name: id.includes('reasoner') ? 'DeepSeek R1' :
                        id.includes('chat') ? 'DeepSeek V3' :
                            id,
                    hasThinking,
                    version: 1
                };
            });

        // If no models returned, add defaults
        if (discoveredModels.length === 0) {
            discoveredModels.push(
                { id: 'deepseek-reasoner', name: 'DeepSeek R1', hasThinking: true, version: 1 },
                { id: 'deepseek-chat', name: 'DeepSeek V3', hasThinking: false, version: 1 }
            );
        }

        return { isValid: true, discoveredModels };
    } catch (error: any) {
        console.error("DeepSeek key verification failed:", error);
        return { isValid: false, error: error.message || "Network Error" };
    }
}

/**
 * Verify OpenRouter API key and discover available models.
 */
export async function verifyOpenRouterKey(apiKey: string): Promise<KeySupport> {
    if (!apiKey || !apiKey.startsWith('sk-or-') || apiKey.length < 30) {
        return { isValid: false, error: "Malformed Key (must start with sk-or-)" };
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { isValid: false, error: err.error?.message || "Invalid Key" };
        }

        const data = await response.json();
        const rawModels = data.data || [];

        // Filter for a selection of powerful models
        const discoveredModels: DiscoveredModel[] = rawModels
            .filter((m: any) => {
                const id = m.id.toLowerCase();
                const whitelist = [
                    'anthropic/claude-3.5-sonnet',
                    'google/gemini-2.0-flash-001',
                    'deepseek/deepseek-r1',
                    'openai/gpt-4o',
                    'meta-llama/llama-3.1-405b'
                ];
                return whitelist.some(w => id.startsWith(w));
            })
            .map((m: any) => {
                const id = m.id;
                const name = m.name || id;
                const hasThinking = id.includes('r1') || id.includes('o1') || id.includes('reasoner');

                return {
                    id,
                    name: `${name} (OR)`,
                    hasThinking,
                    version: id.includes('3.5') ? 3.5 : (id.includes('4o') ? 4 : (id.includes('2.0') ? 2 : 1))
                };
            });

        return { isValid: true, discoveredModels };
    } catch (error: any) {
        console.error("OpenRouter key verification failed:", error);
        return { isValid: false, error: error.message || "Network Error" };
    }
}

/**
 * Verify any provider's API key.
 */
export async function verifyKey(provider: string, apiKey: string): Promise<KeySupport> {
    switch (provider) {
        case 'google': return verifyGoogleKey(apiKey);
        case 'openai': return verifyOpenAIKey(apiKey);
        case 'anthropic': return verifyAnthropicKey(apiKey);
        case 'deepseek': return verifyDeepSeekKey(apiKey);
        case 'openrouter': return verifyOpenRouterKey(apiKey);
        default: return { isValid: false, error: "Unknown provider" };
    }
}
