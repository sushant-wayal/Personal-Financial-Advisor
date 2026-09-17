import { NextResponse } from "next/server";
import { deleteExpiredConversations } from "@/src/services/aiConversation";

export const maxDuration = 60;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await deleteExpiredConversations();

        return NextResponse.json({
            ok: true,
            message: `Successfully cleaned up ${result.deletedCount} expired conversation(s).`,
            deletedCount: result.deletedCount,
            deletedIds: result.deletedIds,
            timestamp: result.timestamp,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[cron-conversations-cleanup] Error cleaning up expired conversations:", error);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
