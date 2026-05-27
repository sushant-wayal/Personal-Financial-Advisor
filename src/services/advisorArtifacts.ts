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
        const parsed = advisorResponseSchema.safeParse(payload);
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
