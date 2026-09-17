import { prisma } from "../lib/prisma";
import { generateText } from "./gemini";

export interface ConversationMetadata {
    name: string;
    expiresInDays: number;
    expiresAt: Date;
    reason: string;
}

export interface ChatTurnResponse {
    narrative: string;
    artifacts: any[];
}

export interface StoredChatTurn {
    question: string;
    response: ChatTurnResponse;
    timestamp?: string;
    runAt?: string;
}

export interface SaveConversationInput {
    conversationId: string;
    question?: string;
    response?: string | ChatTurnResponse | Record<string, unknown>;
    value?: string | StoredChatTurn[];
    name?: string;
    expiresAt?: Date | string;
    tags?: string[];
}

export function fallbackName(question?: string, existingName?: string): string {
    if (existingName && existingName.trim()) return existingName.trim();
    if (!question || !question.trim()) return "AI Conversation";
    const clean = question.replace(/[?.,!]/g, "").trim();
    if (clean.length <= 40) {
        return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean.slice(0, 37).trim() + "…";
}

export function fallbackExpiresInDays(question?: string): number {
    const q = (question || "").toLowerCase();
    if (q.includes("retire") || q.includes("home") || q.includes("mortgage") || q.includes("5 year") || q.includes("wealth")) {
        return 180;
    }
    if (q.includes("goal") || q.includes("invest") || q.includes("emergency fund") || q.includes("portfolio")) {
        return 90;
    }
    if (q.includes("today") || q.includes("lunch") || q.includes("dinner") || q.includes("buy this") || q.includes("yesterday")) {
        return 7;
    }
    return 30;
}

export function normalizeAdvisorResponse(resp: unknown): ChatTurnResponse {
    if (!resp) return { narrative: "", artifacts: [] };
    if (typeof resp === "string") {
        try {
            const parsed = JSON.parse(resp);
            if (parsed && typeof parsed === "object") {
                return {
                    narrative: String(parsed.narrative || parsed.text || parsed.message || ""),
                    artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
                };
            }
        } catch {
            // plain string
        }
        return { narrative: resp, artifacts: [] };
    }
    if (typeof resp === "object" && resp !== null) {
        const r = resp as Record<string, unknown>;
        return {
            narrative: String(r.narrative || r.text || r.message || ""),
            artifacts: Array.isArray(r.artifacts) ? r.artifacts : [],
        };
    }
    return { narrative: String(resp), artifacts: [] };
}

/**
 * Extracts clean, human-readable dialogue text (User / Advisor) without raw JSON UI artifacts.
 * Ideal for LLM system prompt context and metadata evaluation.
 */
export function extractConversationDialogueText(value: string | unknown, maxTurns = 6): string {
    const turns = parseConversationTurns(value);
    if (turns.length === 0) return "";
    const recent = turns.slice(-maxTurns);
    return recent
        .map((t) => {
            const q = t.question ? `User: ${t.question}` : "";
            const a = t.response?.narrative ? `Advisor: ${t.response.narrative}` : "";
            return [q, a].filter(Boolean).join("\n");
        })
        .filter(Boolean)
        .join("\n\n");
}

/**
 * Evaluates the conversation context using Gemini LLM to dynamically determine:
 * 1. A concise human-readable name reflecting the conversation topic.
 * 2. A context-aware expiration duration in days based on financial horizon and permanence.
 */
export async function evaluateConversationMetadata(params: {
    question?: string;
    response?: string;
    existingName?: string;
    fullTranscript?: string;
}): Promise<ConversationMetadata> {
    const prompt = `You are an intelligent financial conversation curator for a personal financial advisor system.
Analyze the following conversation update between a user and their financial advisor.
Your job is to determine:
1. "name": A concise, clear, human-readable title for this conversation (max 50 characters, title case or sentence case, describing the financial topic, e.g., "Emergency Fund Setup", "Weekend Dinner Expense Check", "5-Year Retirement Plan", "Q3 Budget Review"). If an existing name is provided, update or refine it if the conversation has evolved, or keep it coherent.
2. "expiresInDays": An integer number of days this conversation should remain saved before expiring (between 1 and 365 days). Determine this dynamically based on the financial relevance and horizon of the topic:
   - 1 to 7 days: Ephemeral quick checks, daily transaction questions, temporary receipts, or "Can I buy X today?".
   - 14 to 45 days: Monthly budgeting, recurring bill analysis, monthly category limits, salary cycle adjustments.
   - 60 to 180 days: Mid-term financial goals (saving for a car, holiday savings, emergency fund milestones).
   - 180 to 365 days: Major long-term planning (home purchase, retirement planning, long-term portfolio asset allocation, major debt payoff).
3. "reason": A brief one-sentence explanation of why this name and expiration window were chosen.

CONVERSATION CONTEXT:
${params.existingName ? `Existing Conversation Name: "${params.existingName}"\n` : ""}
${params.question ? `Latest User Question: "${params.question}"\n` : ""}
${params.response ? `Advisor Reply: "${params.response.slice(0, 1000)}"\n` : ""}
${params.fullTranscript ? `Transcript Summary: "${params.fullTranscript.slice(0, 1500)}"\n` : ""}

Output strictly valid JSON matching this schema:
{
  "name": "string",
  "expiresInDays": number,
  "reason": "string"
}`;

    try {
        const geminiRes = await generateText(prompt, {
            complexity: "simple",
            responseMimeType: "application/json",
            temperature: 0.2,
        });

        const parsed = JSON.parse(geminiRes.text.trim()) as {
            name?: string;
            expiresInDays?: number;
            reason?: string;
        };

        const rawDays = Number(parsed.expiresInDays);
        const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 365 ? Math.round(rawDays) : fallbackExpiresInDays(params.question);
        const name = (typeof parsed.name === "string" && parsed.name.trim())
            ? parsed.name.trim().slice(0, 50)
            : fallbackName(params.question, params.existingName);
        const expiresAt = new Date(Date.now() + days * 86400000);

        return {
            name,
            expiresInDays: days,
            expiresAt,
            reason: String(parsed.reason || "Evaluated by AI"),
        };
    } catch {
        const days = fallbackExpiresInDays(params.question);
        const name = fallbackName(params.question, params.existingName);
        const expiresAt = new Date(Date.now() + days * 86400000);

        return {
            name,
            expiresInDays: days,
            expiresAt,
            reason: "Fallback heuristic applied",
        };
    }
}

/**
 * Saves or updates a conversation in AIMemory as a single consolidated conversation record.
 * Accumulates multiple to-and-fro turns, preserving all response artifacts.
 * Whenever the conversation is updated, both `name` and `expiresAt` are re-evaluated.
 */
export async function saveOrUpdateConversation(input: SaveConversationInput) {
    const key = input.conversationId.startsWith("chat:")
        ? input.conversationId
        : `chat:${input.conversationId}`;

    const existing = await prisma.aIMemory.findFirst({
        where: { key },
    });

    // Gather existing turns or turns passed directly in value
    let turns: StoredChatTurn[] = [];
    if (input.value) {
        turns = parseConversationTurns(input.value);
    } else if (existing?.value) {
        turns = parseConversationTurns(existing.value);
    }

    // If a new turn (question and/or response) is provided, append if not already last turn
    if (input.question || input.response) {
        const normResponse = normalizeAdvisorResponse(input.response);
        const normQuestion = (input.question || "").trim();
        const nowIso = new Date().toISOString();

        const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
        const isDuplicate = lastTurn &&
            lastTurn.question === normQuestion &&
            lastTurn.response?.narrative === normResponse.narrative &&
            JSON.stringify(lastTurn.response?.artifacts || []) === JSON.stringify(normResponse.artifacts || []);

        if (!isDuplicate && (normQuestion || normResponse.narrative)) {
            turns.push({
                question: normQuestion,
                response: normResponse,
                timestamp: nowIso,
                runAt: nowIso,
            });
        }
    }

    const valueToSave = JSON.stringify(turns);

    let finalName = input.name;
    let finalExpiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    let evalReason = "";

    // If name or expiresAt is not explicitly provided, invoke LLM evaluation
    if (!finalName || !finalExpiresAt) {
        const dialogue = extractConversationDialogueText(valueToSave);
        const respText = typeof input.response === "string"
            ? input.response
            : (typeof input.response?.narrative === "string" ? input.response.narrative : undefined);
        const metadata = await evaluateConversationMetadata({
            question: input.question,
            response: respText,
            existingName: existing?.name || undefined,
            fullTranscript: dialogue,
        });
        if (!finalName) finalName = metadata.name;
        if (!finalExpiresAt) finalExpiresAt = metadata.expiresAt;
        evalReason = metadata.reason;
    }

    const tagsArray: string[] = input.tags || (existing ? JSON.parse(existing.tags || "[]") : ["chat"]);
    if (!tagsArray.includes("chat")) {
        tagsArray.push("chat");
    }

    if (existing) {
        const updated = await prisma.aIMemory.update({
            where: { id: existing.id },
            data: {
                name: finalName,
                expiresAt: finalExpiresAt,
                value: valueToSave,
                tags: JSON.stringify(tagsArray),
            },
        });
        return { conversation: updated, isNew: false, reason: evalReason };
    } else {
        const created = await prisma.aIMemory.create({
            data: {
                key,
                name: finalName,
                expiresAt: finalExpiresAt,
                value: valueToSave,
                tags: JSON.stringify(tagsArray),
            },
        });
        return { conversation: created, isNew: true, reason: evalReason };
    }
}

/**
 * Deletes all conversations where `expiresAt <= now`.
 */
export async function deleteExpiredConversations(now: Date = new Date()) {
    const expired = await prisma.aIMemory.findMany({
        where: {
            expiresAt: {
                lte: now,
            },
        },
        select: { id: true, key: true, name: true, expiresAt: true },
    });

    if (expired.length === 0) {
        return {
            success: true,
            deletedCount: 0,
            deletedIds: [] as string[],
            deletedConversations: [],
            timestamp: now.toISOString(),
        };
    }

    const ids = expired.map((e) => e.id);
    const deleteResult = await prisma.aIMemory.deleteMany({
        where: {
            id: {
                in: ids,
            },
        },
    });

    return {
        success: true,
        deletedCount: deleteResult.count,
        deletedIds: ids,
        deletedConversations: expired,
        timestamp: now.toISOString(),
    };
}

/**
 * Calculates human-readable status, countdown in days, and expired flag.
 */
export function getConversationExpiryInfo(expiresAt?: Date | string | null, now: Date = new Date()) {
    if (!expiresAt) {
        return { isExpired: false, expiresInDays: null, label: "Never expires" };
    }
    const expDate = new Date(expiresAt);
    const diffMs = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    const isExpired = diffMs <= 0;

    let label = "";
    if (isExpired) {
        const daysAgo = Math.abs(diffDays);
        label = daysAgo === 0 ? "Expired today" : `Expired ${daysAgo}d ago`;
    } else if (diffDays === 0) {
        label = "Expires today";
    } else if (diffDays === 1) {
        label = "Expires tomorrow";
    } else {
        label = `Expires in ${diffDays} days`;
    }

    return {
        isExpired,
        expiresInDays: diffDays,
        expiresAt: expDate.toISOString(),
        label,
    };
}

export interface SearchConversationsOptions {
    query?: string;
    page?: number;
    limit?: number;
}

export interface EnrichedConversation {
    id: string;
    key: string;
    name: string | null;
    value: string;
    tags: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
    isExpired: boolean;
    expiresInDays: number | null;
    expiryLabel: string;
}

/**
 * Searches and paginates conversations from the database with backend-driven filtering across
 * `name`, `value` (transcript), and `key`.
 */
export async function searchConversations(options: SearchConversationsOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const baseFilter = {
        OR: [
            { key: { startsWith: "chat:" } },
            { tags: { contains: "chat" } },
        ],
    };

    let where: any = baseFilter;

    if (options.query && options.query.trim()) {
        const q = options.query.trim();
        where = {
            AND: [
                baseFilter,
                {
                    OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { value: { contains: q, mode: "insensitive" } },
                        { key: { contains: q, mode: "insensitive" } },
                    ],
                },
            ],
        };
    }

    const [total, items] = await Promise.all([
        prisma.aIMemory.count({ where }),
        prisma.aIMemory.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            skip,
            take: limit,
        }),
    ]);

    const conversations: EnrichedConversation[] = items.map((item) => {
        const expiry = getConversationExpiryInfo(item.expiresAt);
        return {
            ...item,
            isExpired: expiry.isExpired,
            expiresInDays: expiry.expiresInDays,
            expiryLabel: expiry.label,
        };
    });

    return {
        conversations,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    };
}

/**
 * Parses saved conversation value back into structured chat turns, preserving all LLM artifacts.
 */
export function parseConversationTurns(value: unknown): StoredChatTurn[] {
    if (!value) return [];
    let raw: unknown = value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            raw = JSON.parse(trimmed);
        } catch {
            return [
                {
                    question: "Conversation History",
                    response: { narrative: trimmed, artifacts: [] },
                },
            ];
        }
    }

    if (Array.isArray(raw)) {
        return raw.map((item) => {
            if (!item || typeof item !== "object") {
                return {
                    question: "Query",
                    response: { narrative: String(item), artifacts: [] },
                };
            }
            const record = item as Record<string, unknown>;
            const q = String(record.question || record.user || record.prompt || "");
            const r = normalizeAdvisorResponse(record.response || record.assistant || record.reply);
            const ts = record.timestamp || record.runAt || undefined;
            return {
                question: q,
                response: r,
                timestamp: typeof ts === "string" ? ts : undefined,
                runAt: typeof ts === "string" ? ts : undefined,
            };
        });
    }

    if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.turns)) {
            return parseConversationTurns(obj.turns);
        }
    }

    return [
        {
            question: "Conversation History",
            response: normalizeAdvisorResponse(raw),
        },
    ];
}
