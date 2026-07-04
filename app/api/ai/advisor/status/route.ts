import { NextResponse } from "next/server";
import { getAdvisorStatus } from "../../../../../src/lib/redis";

/**
 * GET /api/ai/advisor/status?requestId=<id>
 *
 * Returns the current live status for an in-flight advisor request.
 * The frontend polls this endpoint every ~1.5s while waiting for the
 * main POST /api/ai/advisor to complete.
 *
 * Response:
 *   200 { type, phase, message, iteration, toolCalls, updatedAt }  — status found
 *   200 { status: null }                                            — not found / Redis unavailable
 *   400 { error: "missing requestId" }
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId || !requestId.trim()) {
        return NextResponse.json({ error: "missing requestId" }, { status: 400 });
    }

    const status = await getAdvisorStatus(requestId.trim());

    return NextResponse.json(
        status ?? { status: null },
        {
            headers: {
                // Short cache — we want fresh data on every poll
                "Cache-Control": "no-store",
            },
        }
    );
}
