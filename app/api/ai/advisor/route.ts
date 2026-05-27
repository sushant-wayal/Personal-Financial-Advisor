import { NextResponse } from "next/server";
import { buildAdvisorChatMessages, buildFinancialContext } from "../../../../src/services/aiContext";
import { advisorResponseJsonSchema, parseAdvisorResponse } from "../../../../src/services/advisorArtifacts";
import { generateText } from "../../../../src/services/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type AdvisorHistoryInput = {
    question?: unknown;
    response?: unknown;
};

export async function POST(req: Request) {
    try {
        const requestId = crypto.randomUUID();

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: "AI provider not configured" }, { status: 503 });
        }

        const body = await req.json();
        const question = body?.question;
        const history = Array.isArray(body?.history) ? body.history : [];

        if (!question) {
            return NextResponse.json({ error: "missing question" }, { status: 400 });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log(`[gemini-advisor] start requestId=${requestId}`);
        }

        const context = await buildFinancialContext(200);
        const normalizedHistory = history
            .map((turn: AdvisorHistoryInput) => ({
                question: typeof turn?.question === "string" ? turn.question : "",
                response: typeof turn?.response === "string"
                    ? turn.response
                    : typeof turn?.response === "object" && turn.response !== null && "narrative" in turn.response && typeof (turn.response as { narrative?: unknown }).narrative === "string"
                        ? (turn.response as { narrative: string }).narrative
                        : "",
            }))
            .filter((turn: { question: string; response: string }) => turn.question || turn.response);

        const advisorMessages = buildAdvisorChatMessages(question, context, normalizedHistory, { structured: true });

        try {
            const response = await generateText(advisorMessages, {
                temperature: 0.05,
                complexity: "complex",
                responseMimeType: "application/json",
                responseSchema: advisorResponseJsonSchema,
            });

            const parsed = parseAdvisorResponse(response.text);
            return NextResponse.json(parsed, { headers: { "X-Request-Id": requestId } });
        } catch (structuredError: unknown) {
            const fallback = await generateText(advisorMessages, { temperature: 0.05, complexity: "complex" });
            const parsed = parseAdvisorResponse(fallback.text);
            if (process.env.NODE_ENV !== "production") {
                console.warn(`[gemini-advisor] structured output failed requestId=${requestId}`, structuredError);
            }
            return NextResponse.json(parsed, { headers: { "X-Request-Id": requestId } });
        }
    } catch (error: unknown) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}