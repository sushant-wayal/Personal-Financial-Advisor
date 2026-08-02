import { NextResponse } from "next/server";
import { buildFinancialContext } from "../../../../src/services/aiContext";
import { runAdvisorAgenticLoop } from "../../../../src/services/advisorAgenticLoop";
import { setAdvisorStatus } from "../../../../src/lib/redis";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type AdvisorHistoryInput = {
    question?: unknown;
    response?: unknown;
};

export async function POST(req: Request) {
    try {
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
        }

        const body = await req.json();
        const question = body?.question;
        const requestId = typeof body?.requestId === "string" ? body.requestId : crypto.randomUUID();
        const history = Array.isArray(body?.history) ? body.history : [];

        if (!question || typeof question !== "string") {
            return NextResponse.json({ error: "missing question" }, { status: 400 });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log(`[advisor] start requestId=${requestId}`);
        }

        // 1. Immediately emit initial status before heavy DB operations start
        await setAdvisorStatus(requestId, {
            type: "status",
            phase: "thinking",
            message: "Connecting & loading financial profile…",
            iteration: 0,
            toolCalls: [],
        });

        const normalizedHistory = (history as AdvisorHistoryInput[])
            .map((turn) => ({
                question: typeof turn?.question === "string" ? turn.question : "",
                response:
                    typeof turn?.response === "string"
                        ? turn.response
                        : typeof turn?.response === "object" &&
                          turn.response !== null &&
                          "narrative" in turn.response &&
                          typeof (turn.response as { narrative?: unknown }).narrative === "string"
                        ? (turn.response as { narrative: string }).narrative
                        : "",
            }))
            .filter((turn) => turn.question || turn.response);

        // 2. Build initial financial context snapshot
        const context = await buildFinancialContext(200);

        // Run the agentic loop — writes status to Redis, returns final result
        const result = await runAdvisorAgenticLoop({
            requestId,
            question,
            context,
            history: normalizedHistory,
        });

        if (process.env.NODE_ENV !== "production") {
            console.log(`[advisor] done requestId=${requestId}`);
        }

        return NextResponse.json(result, {
            headers: { "X-Request-Id": requestId },
        });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}