import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || "gemini-2.5-flash";
const GEMINI_PRO_MODEL = process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiMessage = { role: string; content: string };

function buildGeminiUrl(model: string) {
    return `${GEMINI_BASE_URL}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
}

function toGeminiRequest(promptOrMessages: string | GeminiMessage[], opts?: { temperature?: number; maxTokens?: number }) {
    if (typeof promptOrMessages === "string") {
        return {
            contents: [{ role: "user", parts: [{ text: promptOrMessages }] }],
            generationConfig: {
                temperature: opts?.temperature ?? 0.2,
                maxOutputTokens: opts?.maxTokens ?? 512,
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
            maxOutputTokens: opts?.maxTokens ?? 512,
        },
    };

    if (systemInstruction) body.systemInstruction = systemInstruction;
    return body;
}

function extractTextFromGemini(data: any) {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const parts = candidates.flatMap((c: any) => c?.content?.parts ?? []);
    const texts = parts.map((p: any) => p?.text).filter(Boolean);
    return texts.length ? texts.join("\n") : (data?.text ?? "");
}

export type GeminiResponse = {
    text: string;
    raw?: any;
};

export async function generateText(
    promptOrMessages: string | GeminiMessage[],
    opts?: { temperature?: number; maxTokens?: number; complexity?: "simple" | "complex" }
): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const body = toGeminiRequest(promptOrMessages, opts);
    const model = opts?.complexity === "complex" ? GEMINI_PRO_MODEL : GEMINI_FLASH_MODEL;
    const res = await axios.post(buildGeminiUrl(model), body, {
        headers: {
            "Content-Type": "application/json",
        },
        timeout: 30000,
    });

    const data = res.data;
    const text = extractTextFromGemini(data) || JSON.stringify(data);
    return { text, raw: data };
}
