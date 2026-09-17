import { NextResponse } from "next/server";
import { searchConversations } from "@/src/services/aiConversation";

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const q = url.searchParams.get("q") || undefined;
        const page = parseInt(url.searchParams.get("page") || "1", 10);
        const limit = parseInt(url.searchParams.get("limit") || "10", 10);

        const result = await searchConversations({
            query: q,
            page: isNaN(page) ? 1 : page,
            limit: isNaN(limit) ? 10 : limit,
        });

        return NextResponse.json({
            ok: true,
            conversations: result.conversations,
            pagination: result.pagination,
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[api-ai-conversations] Error searching conversations:", e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
