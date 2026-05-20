import { NextResponse } from "next/server";
import { buildAdvisorMessages, buildFinancialContext } from "../../../../src/services/aiContext";
import { generateText } from "../../../../src/services/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_PRO_MODEL = process.env.GEMINI_PRO_MODEL || "gemini-2.5-pro";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function buildGeminiStreamUrl(model: string, apiKey: string) {
    return `${GEMINI_BASE_URL}/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
}

function extractTextFromGemini(data: any) {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    const first = candidates[0];
    const parts = first?.content?.parts ?? [];
    const texts = parts.map((p: any) => p?.text).filter(Boolean);
    return texts.length ? texts.join("\n") : "";
}

export async function POST(req: Request) {
    try {
        const requestId = crypto.randomUUID();
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
        }
        const { question } = await req.json();
        if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });

        if (process.env.NODE_ENV !== "production") {
            console.log(`[gemini-advisor] start requestId=${requestId}`);
        }

        const context = await buildFinancialContext(200);
        const advisorMessages = buildAdvisorMessages(question, context);
        const upstream = await fetch(buildGeminiStreamUrl(GEMINI_PRO_MODEL, GEMINI_API_KEY), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "text/event-stream",
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: advisorMessages[0].content }] },
                contents: [{ role: "user", parts: [{ text: advisorMessages[1].content }] }],
                generationConfig: { temperature: 0.05, maxOutputTokens: 1200 },
            }),
        });

        if (!upstream.ok) {
            const fallback = await generateText(advisorMessages as any, { temperature: 0.05, maxTokens: 1200, complexity: "complex" });
            return new Response(fallback.text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": requestId } });
        }

        if (!upstream.body) {
            const fallback = await generateText(advisorMessages as any, { temperature: 0.05, maxTokens: 1200, complexity: "complex" });
            return new Response(fallback.text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": requestId } });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let buffer = "";
        let lastText = "";
        let rawResponse = "";

        function emitDelta(text: string, controller: ReadableStreamDefaultController) {
            if (!text) return;
            if (lastText && text.startsWith(lastText)) {
                const delta = text.slice(lastText.length);
                if (delta) controller.enqueue(encoder.encode(delta));
            } else {
                controller.enqueue(encoder.encode(text));
            }
            lastText = text;
        }

        function handleSseEvent(eventText: string, controller: ReadableStreamDefaultController) {
            const dataLines = eventText
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.startsWith("data:"));

            if (!dataLines.length) return;
            const payload = dataLines.map((line) => line.replace(/^data:\s*/, "")).join("\n").trim();
            if (!payload || payload === "[DONE]") return;

            try {
                const json = JSON.parse(payload);
                const text = extractTextFromGemini(json);
                if (text) emitDelta(text, controller);
            } catch {
                // ignore malformed chunks
            }
        }

        const stream = new ReadableStream({
            async start(controller) {
                const reader = upstream.body!.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunkText = decoder.decode(value, { stream: true });
                        rawResponse += chunkText;
                        buffer += chunkText;
                        const events = buffer.split(/\r?\n\r?\n/);
                        buffer = events.pop() || "";
                        for (const eventText of events) {
                            handleSseEvent(eventText, controller);
                        }
                    }
                } catch {
                    // ignore
                } finally {
                    buffer += decoder.decode();
                    if (buffer.trim()) handleSseEvent(buffer, controller);
                    if (process.env.NODE_ENV !== "production" && rawResponse) {
                        console.log(`[gemini-advisor] raw sse response requestId=${requestId}:\n` + rawResponse);
                    }
                    controller.close();
                    reader.releaseLock();
                }
            }
        });

        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Request-Id": requestId } });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
