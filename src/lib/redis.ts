/**
 * redis.ts
 *
 * Upstash Redis client singleton for the advisor status layer.
 *
 * Upstash uses HTTP under the hood — works everywhere (Vercel serverless,
 * Edge, local dev) with no persistent TCP connections.
 *
 * Required env vars (set in .env and Vercel project settings):
 *   UPSTASH_REDIS_REST_URL   — e.g. https://xxxxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN — your Upstash REST token
 *
 * If the env vars are missing the client is null and all status writes
 * silently no-op so the app still works (just without live status updates).
 */

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
    if (_redis) return _redis;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        // Running without Redis — status polling will return nulls gracefully
        return null;
    }

    _redis = new Redis({ url, token });
    return _redis;
}

/** TTL for status keys — 10 minutes is plenty for any advisor response */
const STATUS_TTL_SECONDS = 600;

export type AdvisorStatusEvent = {
    type: "status";
    phase: "thinking" | "querying" | "processing" | "done";
    message: string;
    iteration: number;
    toolCalls: Array<{ name: string; rowCount?: number; done: boolean }>;
    updatedAt: number; // unix ms
};

/** Write the current status for a requestId to Redis */
export async function setAdvisorStatus(
    requestId: string,
    status: Omit<AdvisorStatusEvent, "updatedAt">
): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const payload: AdvisorStatusEvent = { ...status, updatedAt: Date.now() };

    try {
        await redis.set(
            `pfs:advisor:status:${requestId}`,
            JSON.stringify(payload),
            { ex: STATUS_TTL_SECONDS }
        );
    } catch (err) {
        // Non-fatal — status updates are best-effort
        console.warn("[redis] setAdvisorStatus failed:", err);
    }
}

/** Read the current status for a requestId from Redis */
export async function getAdvisorStatus(requestId: string): Promise<AdvisorStatusEvent | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
        const raw = await redis.get<string>(`pfs:advisor:status:${requestId}`);
        if (!raw) return null;
        return typeof raw === "string" ? JSON.parse(raw) : (raw as AdvisorStatusEvent);
    } catch (err) {
        console.warn("[redis] getAdvisorStatus failed:", err);
        return null;
    }
}

/** Delete the status key once the response has been delivered */
export async function clearAdvisorStatus(requestId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        await redis.del(`pfs:advisor:status:${requestId}`);
    } catch {
        // ignore
    }
}
