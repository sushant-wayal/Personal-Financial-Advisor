import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = process.env.GEMINI_API_URL || "https://api.gemini.example/v1/generate";

export type GeminiResponse = {
    text: string;
    raw?: any;
};

export async function generateText(promptOrMessages: string | { role: string; content: string }[], opts?: { temperature?: number; maxTokens?: number }): Promise<GeminiResponse> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

    const payload = typeof promptOrMessages === 'string'
        ? { prompt: promptOrMessages }
        : { messages: promptOrMessages };

    const body = {
        ...payload,
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 512,
    };

    const res = await axios.post(GEMINI_API_URL, body, {
        headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
        },
        timeout: 30000,
    });

    const data = res.data;
    const text = data?.text ?? (Array.isArray(data?.choices) ? data.choices.map((c: any) => c.text || c.message?.content).join('\n') : JSON.stringify(data));
    return { text, raw: data };
}
