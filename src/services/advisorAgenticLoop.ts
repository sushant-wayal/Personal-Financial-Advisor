/**
 * advisorAgenticLoop.ts
 *
 * The agentic orchestration layer for the AI advisor.
 *
 * Runs a multi-turn loop where the LLM can call database tools up to
 * MAX_TOOL_ITERATIONS times before producing a final answer.
 *
 * Status updates are written to Redis at each step so the polling endpoint
 * (/api/ai/advisor/status) can surface them to the frontend in real time.
 *
 * The final response (narrative + artifacts) is returned as a plain value
 * for the caller (route.ts) to return as a normal JSON HTTP response.
 */

import { ADVISOR_TOOL_DECLARATIONS, executeAdvisorTool, ToolName } from "./advisorDbTools";
import { buildAdvisorChatMessages } from "./aiContext";
import { parseAdvisorResponse } from "./advisorArtifacts";
import { generateTextWithTools } from "./gemini";
import { setAdvisorStatus, clearAdvisorStatus } from "../lib/redis";
import type { AdvisorResponse } from "@/src/types/advisor";

const MAX_TOOL_ITERATIONS = 4;

// ─── Status helpers ───────────────────────────────────────────────────────────

type StatusPhase = "thinking" | "querying" | "processing" | "done";

type ToolCallState = { name: string; rowCount?: number; done: boolean };

/** Current accumulated status we keep in memory and push to Redis */
type MutableStatus = {
    phase: StatusPhase;
    message: string;
    iteration: number;
    toolCalls: ToolCallState[];
};

async function pushStatus(requestId: string, status: MutableStatus): Promise<void> {
    await setAdvisorStatus(requestId, { type: "status", ...status });
}

/** Human-friendly description of a tool call for the status message */
function describeToolCall(name: string, args: Record<string, unknown>): string {
    switch (name) {
        case "queryTransactions": {
            const parts: string[] = [];
            if (args.dateRange) parts.push(String(args.dateRange));
            else if (args.dateFrom || args.dateTo)
                parts.push(`${args.dateFrom ?? ""} → ${args.dateTo ?? ""}`);
            if (args.merchant) parts.push(`merchant: ${args.merchant}`);
            if (args.category) parts.push(`category: ${args.category}`);
            if (args.type) parts.push(String(args.type));
            return `Fetching transactions${parts.length ? " (" + parts.join(", ") + ")" : ""}`;
        }
        case "aggregateTransactions":
            return `Computing ${args.metric ?? "sum"} by ${args.groupBy ?? "category"}${args.dateRange ? " (" + args.dateRange + ")" : ""}`;
        case "queryGoals":
            return "Reading financial goals";
        case "querySubscriptions":
            return "Reading recurring subscriptions";
        case "queryCategories":
            return "Loading category structure";
        case "queryBudgets":
            return "Reading category budgets & limits";
        case "addBudget":
            return `Creating budget for ${args.categoryName || "category"}`;
        case "updateBudget":
            return "Updating budget limit";
        case "deleteBudget":
            return "Removing category budget";
        case "addTransaction":
            return `Recording transaction (${args.merchant || "entry"} $${args.amount || ""})`;
        case "updateTransaction":
            return "Updating transaction record";
        case "deleteTransaction":
            return "Deleting transaction record";
        case "addGoal":
            return `Adding financial goal (${args.title || ""})`;
        case "updateGoal":
            return "Updating financial goal";
        case "deleteGoal":
            return "Deleting financial goal";
        case "getFinancialProfile":
            return "Reading financial profile & balances";
        case "updateFinancialProfile":
            return "Updating financial profile parameters";
        case "queryMemories":
            return "Searching stored AI memory";
        case "queryInsights":
            return "Loading financial insights & trends";
        default:
            return `Querying database (${name})`;
    }
}

/** Rough count of rows/items in a tool result for the UI */
function countRows(data: unknown): number | undefined {
    if (!data || typeof data !== "object") return undefined;
    const d = data as Record<string, unknown>;
    if (typeof d.total === "number") return d.total;
    if (Array.isArray(d.rows)) return d.rows.length;
    if (Array.isArray(d.goals)) return d.goals.length;
    if (Array.isArray(d.subscriptions)) return d.subscriptions.length;
    if (Array.isArray(d.categories)) return d.categories.length;
    if (Array.isArray(d.budgets)) return d.budgets.length;
    if (Array.isArray(d.memories)) return d.memories.length;
    if (Array.isArray(d.insights)) return d.insights.length;
    if (Array.isArray(d.results)) return d.results.length;
    if (d.profile) return 1;
    if (d.transaction) return 1;
    return undefined;
}

// ─── Gemini content types for multi-turn tool calling ─────────────────────────

type GeminiPart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { content: unknown } } };

type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

function contentsToMessages(
    contents: GeminiContent[],
    systemInstruction?: string
): Array<{ role: string; content: string }> {
    const msgs = contents.map((c) => ({
        role: c.role === "model" ? "assistant" : "user",
        content: c.parts
            .map((p) => {
                const part = p as Record<string, unknown>;
                if (typeof part.text === "string") return part.text;
                if (part.functionCall)
                    return `[tool call: ${JSON.stringify(part.functionCall)}]`;
                if (part.functionResponse)
                    return `[tool result: ${JSON.stringify(
                        (part.functionResponse as Record<string, unknown>)?.response
                    )}]`;
                return "";
            })
            .join("\n"),
    }));

    return systemInstruction
        ? [{ role: "system", content: systemInstruction }, ...msgs]
        : msgs;
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

export type AdvisorAgenticOptions = {
    requestId: string;
    question: string;
    context: unknown;
    history?: Array<{ question: string; response: string }>;
};

/**
 * Run the advisor agentic loop.
 *
 * Writes live status to Redis at each step so the polling endpoint
 * can surface progress to the frontend.
 *
 * Returns the final AdvisorResponse (narrative + artifacts) as a plain value.
 * The caller (route.ts) returns this as a normal JSON HTTP response body.
 */
export async function runAdvisorAgenticLoop(
    options: AdvisorAgenticOptions
): Promise<AdvisorResponse> {
    const { requestId, question, context, history } = options;

    const status: MutableStatus = {
        phase: "thinking",
        message: "Reading your financial data…",
        iteration: 0,
        toolCalls: [],
    };

    await pushStatus(requestId, status);

    try {
        // Build initial messages
        const baseMessages = buildAdvisorChatMessages(
            question,
            context,
            history ?? [],
            { structured: true }
        );

        // Separate system instruction from conversation
        let systemInstruction: string | undefined;
        const geminiContents: GeminiContent[] = [];

        for (const msg of baseMessages) {
            if (msg.role === "system") {
                systemInstruction = msg.content;
                continue;
            }
            geminiContents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
            });
        }

        const conversationContents: GeminiContent[] = [...geminiContents];
        let finalText: string | undefined;

        for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            status.iteration = i + 1;
            status.phase = "thinking";
            status.message =
                i === 0 ? "Analysing your question…" : `Refining analysis (step ${i + 1})…`;
            await pushStatus(requestId, status);

            const messages = contentsToMessages(conversationContents, systemInstruction);

            const response = await generateTextWithTools(
                messages,
                ADVISOR_TOOL_DECLARATIONS as Record<string, unknown>[],
                { temperature: 0.05, complexity: "complex" }
            );

            if (typeof response.text === "string" && response.text.trim().length > 0) {
                finalText = response.text;
                break;
            }

            if (!response.toolCalls || response.toolCalls.length === 0) break;

            // Append model's tool call turn to conversation
            conversationContents.push({
                role: "model",
                parts: response.toolCalls.map((tc) => ({
                    functionCall: { name: tc.name, args: tc.args },
                })),
            });

            const toolResponseParts: GeminiPart[] = [];

            for (const tc of response.toolCalls) {
                // Add pending tool call to status
                const tcState: ToolCallState = { name: tc.name, done: false };
                status.toolCalls = [...status.toolCalls, tcState];
                status.phase = "querying";
                status.message = describeToolCall(tc.name, tc.args);
                await pushStatus(requestId, status);

                // Execute the tool through the abstraction layer
                const result = await executeAdvisorTool({
                    name: tc.name as ToolName,
                    args: tc.args,
                });

                // Mark it done
                const rowCount = countRows(result.data);
                status.toolCalls = status.toolCalls.map((t) =>
                    t.name === tc.name && !t.done ? { ...t, done: true, rowCount } : t
                );
                status.phase = "processing";
                status.message = "Processing results…";
                await pushStatus(requestId, status);

                toolResponseParts.push({
                    functionResponse: {
                        name: tc.name,
                        response: {
                            content: result.error ? { error: result.error } : result.data,
                        },
                    },
                });
            }

            // Append tool results as a user turn (Gemini protocol)
            conversationContents.push({ role: "user", parts: toolResponseParts });
        }

        // If we exhausted iterations without a final answer, do one last pass
        if (finalText === undefined) {
            status.phase = "thinking";
            status.message = "Composing final answer…";
            await pushStatus(requestId, status);

            const { generateText } = await import("./gemini");
            const messages = contentsToMessages(conversationContents, systemInstruction);
            const fallback = await generateText(messages, {
                temperature: 0.05,
                complexity: "complex",
            });
            finalText = fallback.text?.trim() || undefined;

            if (!finalText) {
                return {
                    narrative: "The advisor couldn't generate a response. This may be a temporary issue — please try again.",
                    artifacts: [],
                };
            }
        }

        // Mark done in Redis before returning
        status.phase = "done";
        status.message = "Analysis complete";
        await pushStatus(requestId, status);

        return parseAdvisorResponse(finalText ?? "");
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[advisorAgenticLoop] Error:", message);

        // Write error status so frontend can stop polling
        await setAdvisorStatus(requestId, {
            type: "status",
            phase: "done",
            message: `Error: ${message}`,
            iteration: status.iteration,
            toolCalls: status.toolCalls,
        });

        return { narrative: `I encountered an error: ${message}`, artifacts: [] };
    } finally {
        // Clean up Redis key after a short delay (give the frontend time to read "done")
        setTimeout(() => {
            clearAdvisorStatus(requestId).catch(() => { });
        }, 30_000);
    }
}
