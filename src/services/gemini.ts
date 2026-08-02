import axios from "axios";

function getApiKey() {
    return process.env.GEMINI_API_KEY || "";
}

function getFlashModel() {
    return process.env.GEMINI_FLASH_MODEL || "gemini-3.5-flash";
}

function getProModel() {
    return process.env.GEMINI_PRO_MODEL || "gemini-3.5-flash";
}

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiMessage = { role: string; content: string };

type GeminiOptions = {
    temperature?: number;
    complexity?: "simple" | "complex";
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
    enableSearch?: boolean;
    model?: string;
};

export type ToolCallParsed = {
    name: string;
    args: Record<string, unknown>;
};

export type GeminiWithToolsResponse = {
    /** Present when the model has produced a final text answer. */
    text?: string;
    /** Present when the model wants to call one or more tools. */
    toolCalls?: ToolCallParsed[];
    /** Raw Gemini API response for debugging. */
    raw?: unknown;
};

function buildGeminiUrl(model: string) {
    return `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(getApiKey())}`;
}

export function buildGeminiRequest(promptOrMessages: string | GeminiMessage[], opts?: GeminiOptions) {
    if (typeof promptOrMessages === "string") {
        return {
            contents: [{ role: "user", parts: [{ text: promptOrMessages }] }],
            generationConfig: {
                temperature: opts?.temperature ?? 0.2,
                ...(opts?.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
                ...(opts?.responseSchema ? { responseSchema: opts.responseSchema } : {}),
            },
        };
    }

    let systemInstruction: { parts: { text: string }[] } | undefined;
    const contents = promptOrMessages
        .filter((m) => m?.content)
        .map((m) => {
            if (m.role === "system" && !systemInstruction) {
                systemInstruction = { parts: [{ text: m.content }] };
                return null;
            }
            const role = m.role === "assistant" ? "model" : (m.role === "user" ? "user" : "user");
            return { role, parts: [{ text: m.content }] };
        })
        .filter(Boolean) as Array<{ role: "user" | "model"; parts: { text: string }[] }>;

    const body: any = {
        contents,
        generationConfig: {
            temperature: opts?.temperature ?? 0.2,
            ...(opts?.responseMimeType ? { responseMimeType: opts.responseMimeType } : {}),
            ...(opts?.responseSchema ? { responseSchema: opts.responseSchema } : {}),
        },
    };

    if (opts?.enableSearch) {
        body.tools = [{ googleSearch: {} }];
    }

    if (systemInstruction) body.systemInstruction = systemInstruction;
    return body;
}

function extractTextFromGemini(data: any): string | undefined {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const parts = candidates.flatMap((c: any) => c?.content?.parts ?? []);
    const texts = parts.map((p: any) => p?.text).filter((t: unknown) => typeof t === "string" && t.trim().length > 0);
    if (texts.length) return texts.join("\n");
    if (typeof data?.text === "string" && data.text.trim().length > 0) return data.text;
    return undefined;
}

export type GeminiResponse = {
    text: string;
    raw?: any;
};

export async function generateText(
    promptOrMessages: string | GeminiMessage[],
    opts?: GeminiOptions
): Promise<GeminiResponse> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const flashModel = getFlashModel();
    const defaultModel = opts?.complexity === "complex" ? getProModel() : flashModel;
    const body = buildGeminiRequest(promptOrMessages, opts);
    let model = opts?.model || defaultModel;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await axios.post(buildGeminiUrl(model), body, {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            });

            const data = res.data;
            const text = extractTextFromGemini(data) ?? "";
            return { text, raw: data };
        } catch (error: any) {
            lastError = error;
            const status = error?.response?.status;
            if (status && status >= 400) {
                const body = error?.response?.data;
                console.error(
                    `[gemini] generateText with model ${model} failed (HTTP ${status}):`,
                    typeof body === "object" ? JSON.stringify(body) : body
                );
            }

            // Automatic fallback to flashModel on 404 or 429 quota exhaustion
            if ((status === 404 || status === 429) && model !== flashModel) {
                console.warn(`[gemini] Falling back from ${model} to ${flashModel}`);
                model = flashModel;
                continue;
            }

            const retryable = status === 429 || status === 503 || !status;
            if (!retryable || attempt === 2) {
                throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to generate Gemini response");
}

/**
 * Send a request to Gemini with function-calling tool declarations.
 * Returns either a final text answer (model chose to stop) or a list of
 * tool calls the model wants to make.
 *
 * Caller is responsible for the agentic loop.
 */
export async function generateTextWithTools(
    promptOrMessages: string | GeminiMessage[],
    toolDeclarations: Record<string, unknown>[],
    opts?: GeminiOptions
): Promise<GeminiWithToolsResponse> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const flashModel = getFlashModel();
    const defaultModel = opts?.complexity === "complex" ? getProModel() : flashModel;
    const body = buildGeminiRequest(promptOrMessages, opts);
    let model = opts?.model || defaultModel;

    // Attach tool declarations
    if (toolDeclarations.length > 0) {
        (body as Record<string, unknown>).tools = [{ functionDeclarations: toolDeclarations }];
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await axios.post(buildGeminiUrl(model), body, {
                headers: { "Content-Type": "application/json" },
                timeout: 45000,
            });

            const data = res.data;
            const candidate = Array.isArray(data?.candidates) ? data.candidates[0] : null;
            const content = candidate?.content;
            const parts: unknown[] = Array.isArray(content?.parts) ? content.parts : [];

            // Check for function call parts
            const fnParts = parts.filter(
                (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
                    typeof (p as Record<string, unknown>)?.functionCall === "object" &&
                    (p as Record<string, unknown>)?.functionCall !== null
            );

            if (fnParts.length > 0) {
                const toolCalls: ToolCallParsed[] = fnParts.map((p) => ({
                    name: p.functionCall.name,
                    args: p.functionCall.args ?? {},
                }));
                return { toolCalls, raw: data };
            }

            // No function calls — extract text as final answer
            const text = extractTextFromGemini(data);
            return { text, raw: data };
        } catch (error: unknown) {
            lastError = error;
            const errObj = error as { response?: { status?: number; data?: unknown } };
            const status = errObj?.response?.status;
            if (status && status >= 400) {
                const body = errObj?.response?.data;
                console.error(
                    `[gemini] generateTextWithTools with model ${model} failed (HTTP ${status}):`,
                    typeof body === "object" ? JSON.stringify(body) : body
                );
            }

            // Automatic fallback to flashModel on 404 or 429 quota exhaustion
            if ((status === 404 || status === 429) && model !== flashModel) {
                console.warn(`[gemini] Falling back from ${model} to ${flashModel}`);
                model = flashModel;
                continue;
            }

            const retryable = status === 429 || status === 503 || !status;
            if (!retryable || attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to generate Gemini response with tools");
}

