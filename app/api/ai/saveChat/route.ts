import { NextResponse } from "next/server";
import { saveOrUpdateConversation } from "../../../../src/services/aiConversation";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const conversationId = body.conversationId || body.key;
        if (!conversationId || (!body.value && !body.response)) {
            return NextResponse.json({ error: "missing conversationId or value" }, { status: 400 });
        }

        const result = await saveOrUpdateConversation({
            conversationId,
            question: body.question,
            response: body.response || body.value,
            value: body.value,
            name: body.name,
            expiresAt: body.expiresAt,
            tags: ["chat"],
        });

        return NextResponse.json({ ok: true, memory: result.conversation, reason: result.reason });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
