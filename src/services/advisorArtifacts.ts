import { z, toJSONSchema } from "zod";
import type { AdvisorResponse } from "@/types/advisor";

const toneSchema = z.enum(["critical", "warning", "neutral", "success", "positive", "negative", "info"]);
const prioritySchema = z.enum(["critical", "high", "medium", "low"]);
const statusSchema = z.enum(["critical", "warning", "neutral", "healthy", "success"]);

const metricSchema = z.object({
    label: z.string().min(1),
    value: z.string().min(1),
    tone: toneSchema.optional(),
    note: z.string().optional(),
}).passthrough();

const healthCardSchema = z.object({
    type: z.literal("healthCard"),
    title: z.string().min(1),
    status: statusSchema,
    summary: z.string().optional(),
    metrics: z.array(metricSchema).max(4).optional(),
    note: z.string().optional(),
}).passthrough();

const dualMetricSchema = z.object({
    type: z.literal("dualMetric"),
    left: metricSchema,
    right: metricSchema,
}).passthrough();

const metricsGridSchema = z.object({
    type: z.literal("metricsGrid"),
    title: z.string().optional(),
    metrics: z.array(metricSchema).min(2).max(6),
}).passthrough();

const riskListSchema = z.object({
    type: z.literal("riskList"),
    title: z.string().min(1),
    items: z.array(z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        severity: toneSchema.optional(),
    }).passthrough()).min(1).max(6),
}).passthrough();

const warningSchema = z.object({
    type: z.literal("warning"),
    title: z.string().min(1),
    content: z.string().min(1),
    severity: toneSchema.optional(),
}).passthrough();

const directiveSchema = z.object({
    type: z.literal("directive"),
    title: z.string().min(1),
    content: z.string().min(1),
    priority: prioritySchema.optional(),
}).passthrough();

const recommendationSchema = z.object({
    type: z.literal("recommendation"),
    title: z.string().min(1),
    content: z.string().min(1),
    reasoning: z.string().optional(),
    nextStep: z.string().optional(),
    tone: toneSchema.optional(),
}).passthrough();

const goalCardSchema = z.object({
    type: z.literal("goalCard"),
    title: z.string().min(1),
    status: statusSchema.optional(),
    progressPct: z.number().min(0).max(100).optional(),
    progressLabel: z.string().optional(),
    currentLabel: z.string().optional(),
    targetLabel: z.string().optional(),
    note: z.string().optional(),
}).passthrough();

const goalTimelineSchema = z.object({
    type: z.literal("goalTimeline"),
    title: z.string().min(1),
    items: z.array(z.object({
        label: z.string().min(1),
        date: z.string().optional(),
        status: toneSchema.optional(),
        note: z.string().optional(),
    }).passthrough()).min(1).max(8),
}).passthrough();

const comparisonTableSchema = z.object({
    type: z.literal("comparisonTable"),
    title: z.string().min(1),
    columns: z.array(z.string().min(1)).min(2).max(4),
    rows: z.array(z.object({
        label: z.string().min(1),
        values: z.array(z.string().min(1)).min(1).max(4),
    }).passthrough()).min(1).max(8),
}).passthrough();

const priorityCardSchema = z.object({
    type: z.literal("priorityCard"),
    title: z.string().min(1),
    priority: prioritySchema,
    summary: z.string().min(1),
    reasons: z.array(z.string().min(1)).max(5).optional(),
}).passthrough();

const decisionSummarySchema = z.object({
    type: z.literal("decisionSummary"),
    title: z.string().min(1),
    decision: z.string().min(1),
    recommendation: z.string().min(1),
    tradeoffs: z.array(z.string().min(1)).max(5).optional(),
    nextStep: z.string().optional(),
}).passthrough();

type LooseRecord = Record<string, unknown>;

function asLooseRecord(value: unknown): LooseRecord | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as LooseRecord : null;
}

function toStringValue(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeTone(value: unknown): z.infer<typeof toneSchema> | undefined {
    if (typeof value !== "string") return undefined;
    const lower = value.trim().toLowerCase();
    if (lower === "critical" || lower === "warning" || lower === "neutral" || lower === "success" || lower === "positive" || lower === "negative" || lower === "info") {
        return lower;
    }
    return undefined;
}

function normalizePriority(value: unknown): z.infer<typeof prioritySchema> | undefined {
    if (typeof value !== "string") return undefined;
    const lower = value.trim().toLowerCase();
    if (lower === "critical" || lower === "high" || lower === "medium" || lower === "low") {
        return lower;
    }
    return undefined;
}

function normalizeStatus(value: unknown): z.infer<typeof statusSchema> | undefined {
    if (typeof value !== "string") return undefined;
    const lower = value.trim().toLowerCase();
    if (lower === "critical" || lower === "warning" || lower === "neutral" || lower === "healthy" || lower === "success") {
        return lower;
    }
    return undefined;
}

function normalizeMetric(value: unknown) {
    const record = asLooseRecord(value);
    if (!record) return null;
    const label = toStringValue(record.label ?? record.name);
    const metricValue = toStringValue(record.value ?? record.amount ?? record.text ?? record.label);
    if (!label || !metricValue) return null;
    return {
        label,
        value: metricValue,
        tone: normalizeTone(record.tone),
        note: toStringValue(record.note),
    };
}

function normalizeItemsToReasons(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const reasons = value
        .map((item) => {
            const record = asLooseRecord(item);
            if (!record) return null;
            const title = toStringValue(record.title ?? record.label);
            const description = toStringValue(record.description ?? record.content ?? record.summary);
            if (title && description) return `${title}: ${description}`;
            if (description) return description;
            if (title) return title;
            return null;
        })
        .filter((entry): entry is string => Boolean(entry));

    return reasons.length > 0 ? reasons.slice(0, 5) : undefined;
}

function normalizeArtifact(value: unknown): unknown {
    const record = asLooseRecord(value);
    if (!record || typeof record.type !== "string") {
        return value;
    }

    const type = record.type;

    if (type === "healthCard") {
        return {
            type,
            title: toStringValue(record.title, "Financial Health"),
            status: normalizeStatus(record.status) ?? "neutral",
            summary: toStringValue(record.summary ?? record.description),
            metrics: Array.isArray(record.metrics) ? record.metrics.map(normalizeMetric).filter(Boolean).slice(0, 4) : undefined,
            note: toStringValue(record.note),
        };
    }

    if (type === "dualMetric") {
        const left = normalizeMetric(record.left);
        const right = normalizeMetric(record.right);
        if (!left || !right) return value;
        return { type, left, right };
    }

    if (type === "metricsGrid") {
        const metrics = Array.isArray(record.metrics) ? record.metrics.map(normalizeMetric).filter(Boolean) : [];
        if (metrics.length < 2) return value;
        return { type, title: toStringValue(record.title), metrics: metrics.slice(0, 6) };
    }

    if (type === "riskList") {
        const items = Array.isArray(record.items)
            ? record.items
                .map((item) => {
                    const itemRecord = asLooseRecord(item);
                    if (!itemRecord) return null;
                    const title = toStringValue(itemRecord.title ?? itemRecord.label);
                    const description = toStringValue(itemRecord.description ?? itemRecord.content ?? itemRecord.summary);
                    if (!title || !description) return null;
                    return { title, description, severity: normalizeTone(itemRecord.severity) };
                })
                .filter(Boolean)
            : [];
        if (items.length < 1) return value;
        return { type, title: toStringValue(record.title, "Key Risks"), items: items.slice(0, 6) };
    }

    if (type === "warning") {
        return {
            type,
            title: toStringValue(record.title, "Warning"),
            content: toStringValue(record.content ?? record.description),
            severity: normalizeTone(record.severity),
        };
    }

    if (type === "directive") {
        return {
            type,
            title: toStringValue(record.title, "Recommended Action"),
            content: toStringValue(record.content ?? record.description),
            priority: normalizePriority(record.priority),
        };
    }

    if (type === "recommendation") {
        return {
            type,
            title: toStringValue(record.title, "Recommendation"),
            content: toStringValue(record.content ?? record.description),
            reasoning: toStringValue(record.reasoning),
            nextStep: toStringValue(record.nextStep),
            tone: normalizeTone(record.tone),
        };
    }

    if (type === "goalCard") {
        return {
            type,
            title: toStringValue(record.title, "Goal"),
            status: normalizeStatus(record.status),
            progressPct: typeof record.progressPct === "number" ? record.progressPct : undefined,
            progressLabel: toStringValue(record.progressLabel),
            currentLabel: toStringValue(record.currentLabel),
            targetLabel: toStringValue(record.targetLabel),
            note: toStringValue(record.note ?? record.description),
        };
    }

    if (type === "goalTimeline") {
        const items = Array.isArray(record.items)
            ? record.items
                .map((item) => {
                    const itemRecord = asLooseRecord(item);
                    if (!itemRecord) return null;
                    const label = toStringValue(itemRecord.label ?? itemRecord.title);
                    if (!label) return null;
                    return {
                        label,
                        date: toStringValue(itemRecord.date),
                        status: normalizeTone(itemRecord.status),
                        note: toStringValue(itemRecord.note ?? itemRecord.description),
                    };
                })
                .filter(Boolean)
            : [];
        if (items.length < 1) return value;
        return { type, title: toStringValue(record.title, "Timeline"), items: items.slice(0, 8) };
    }

    if (type === "comparisonTable") {
        const columns = Array.isArray(record.columns)
            ? record.columns.map((column) => toStringValue(column)).filter(Boolean)
            : [];
        const rows = Array.isArray(record.rows)
            ? record.rows
                .map((row) => {
                    const rowRecord = asLooseRecord(row);
                    if (!rowRecord) return null;
                    const label = toStringValue(rowRecord.label ?? rowRecord.title);
                    const values = Array.isArray(rowRecord.values) ? rowRecord.values.map((item) => toStringValue(item)).filter(Boolean) : [];
                    if (!label || values.length < 1) return null;
                    return { label, values: values.slice(0, 4) };
                })
                .filter(Boolean)
            : [];
        if (columns.length < 2 || rows.length < 1) return value;
        return { type, title: toStringValue(record.title, "Comparison"), columns: columns.slice(0, 4), rows: rows.slice(0, 8) };
    }

    if (type === "priorityCard") {
        const reasons = normalizeItemsToReasons(record.items) ?? (Array.isArray(record.reasons) ? record.reasons.map((reason) => toStringValue(reason)).filter(Boolean).slice(0, 5) : undefined);
        return {
            type,
            title: toStringValue(record.title, "Immediate Priorities"),
            priority: normalizePriority(record.priority) ?? "high",
            summary: toStringValue(record.summary ?? record.description ?? (Array.isArray(reasons) ? reasons[0] : ""), "Review the highest-impact actions first."),
            reasons,
        };
    }

    if (type === "decisionSummary") {
        return {
            type,
            title: toStringValue(record.title, "Decision Summary"),
            decision: toStringValue(record.decision ?? record.summary, ""),
            recommendation: toStringValue(record.recommendation ?? record.content, ""),
            tradeoffs: Array.isArray(record.tradeoffs) ? record.tradeoffs.map((tradeoff) => toStringValue(tradeoff)).filter(Boolean).slice(0, 5) : undefined,
            nextStep: toStringValue(record.nextStep),
        };
    }

    return value;
}

function normalizeAdvisorPayload(payload: unknown): unknown {
    const record = asLooseRecord(payload);
    if (!record) {
        return payload;
    }

    const narrative = toStringValue(record.narrative ?? record.text ?? record.content, "");
    const artifacts = Array.isArray(record.artifacts) ? record.artifacts.map(normalizeArtifact).filter(Boolean) : [];

    return {
        narrative,
        artifacts,
    };
}

export const advisorArtifactSchema = z.discriminatedUnion("type", [
    healthCardSchema,
    dualMetricSchema,
    metricsGridSchema,
    riskListSchema,
    warningSchema,
    directiveSchema,
    recommendationSchema,
    goalCardSchema,
    goalTimelineSchema,
    comparisonTableSchema,
    priorityCardSchema,
    decisionSummarySchema,
]);

export const advisorResponseSchema = z.object({
    narrative: z.string().trim().min(1),
    artifacts: z.array(advisorArtifactSchema).max(6).default([]),
}).passthrough();

export const advisorResponseJsonSchema = toJSONSchema(advisorResponseSchema) as Record<string, unknown>;

function extractJsonPayload(text: string) {
    const trimmed = text.trim();

    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
        return trimmed.slice(firstArray, lastArray + 1).trim();
    }

    const firstObject = trimmed.indexOf("{");
    const lastObject = trimmed.lastIndexOf("}");
    if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
        return trimmed.slice(firstObject, lastObject + 1).trim();
    }

    return trimmed;
}

export function parseAdvisorResponse(rawResponse: string): AdvisorResponse {
    const trimmed = rawResponse.trim();
    if (!trimmed) {
        return { narrative: "No response", artifacts: [] };
    }

    try {
        const payload = JSON.parse(extractJsonPayload(trimmed));
        const normalized = normalizeAdvisorPayload(payload);
        const parsed = advisorResponseSchema.safeParse(normalized);
        if (parsed.success) {
            return parsed.data;
        }
    } catch {
        // fall through to narrative fallback
    }

    return {
        narrative: trimmed,
        artifacts: [],
    };
}
