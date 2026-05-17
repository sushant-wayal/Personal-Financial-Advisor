import { NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = process.env.GEMINI_API_URL;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const question = body.question;
        if (!question) return NextResponse.json({ error: 'missing question' }, { status: 400 });

        if (!GEMINI_API_KEY || !GEMINI_API_URL) {
            // fallback to non-streaming advisor
            const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ai/advisor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
            const data = await resp.json();
            return NextResponse.json({ ok: true, text: data.result?.text || JSON.stringify(data.result) });
        }

        // Proxy to Gemini streaming endpoint. We'll open a connection and stream chunks as plain text to client.
        const upstream = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${GEMINI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages: [{ role: 'user', content: question }], stream: true }),
        });

        if (!upstream.body) {
            const text = await upstream.text();
            return NextResponse.json({ ok: true, text });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                const reader = upstream.body!.getReader();
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        // forward chunk as-is (SSE framing not required, client reads raw chunks)
                        controller.enqueue(value);
                    }
                } catch (e) {
                    // ignore
                } finally {
                    controller.close();
                    reader.releaseLock();
                }
            }
        });

        return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
