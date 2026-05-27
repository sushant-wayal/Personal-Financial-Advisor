import { z, toJSONSchema } from "zod";
import type { AdvisorResponse, AdvisorArtifact } from "@/types/advisor";

/**
 * Extremely permissive schemas.
 * Gemini output changes frequently.
 * We validate only the top-level structure and
 * leave artifact validation to UI renderers.
 */

export const advisorArtifactSchema = z
    .object({
        type: z.string().optional(),
    })
    .passthrough();

export const advisorResponseSchema = z
    .object({
        narrative: z.string().catch(""),
        artifacts: z.array(z.any()).catch([]),
    })
    .passthrough();

export const advisorResponseJsonSchema =
    toJSONSchema(advisorResponseSchema) as Record<
        string,
        unknown
    >;

function stripCodeFences(text: string): string {
    const trimmed = text.trim();

    const fencedMatch = trimmed.match(
        /^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i
    );

    return fencedMatch?.[1]?.trim() ?? trimmed;
}

function extractFirstJsonObject(
    text: string
): string | null {
    let depth = 0;
    let start = -1;

    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }

            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === "{") {
            if (depth === 0) {
                start = i;
            }

            depth++;
            continue;
        }

        if (ch === "}") {
            depth--;

            if (
                depth === 0 &&
                start !== -1
            ) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

function cleanJsonText(text: string): string {
    return text
        .trim()
        .replace(/^['"`]/, "")
        .replace(/['"`]$/, "")
        .replace(/'\s*\+\s*'/g, "")
        .replace(/"\s*\+\s*"/g, "")
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
}

function parseJsonSafely(
    text: string
): Record<string, unknown> | null {
    const cleaned = cleanJsonText(
        stripCodeFences(text)
    );

    try {
        const parsed = JSON.parse(cleaned);

        if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
        ) {
            return parsed as Record<
                string,
                unknown
            >;
        }
    } catch { }

    try {
        const unescaped = cleaned
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\");

        const parsed =
            JSON.parse(unescaped);

        if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
        ) {
            return parsed as Record<
                string,
                unknown
            >;
        }
    } catch { }

    const extracted =
        extractFirstJsonObject(cleaned);

    if (extracted) {
        try {
            const parsed =
                JSON.parse(extracted);

            if (
                parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
            ) {
                return parsed as Record<
                    string,
                    unknown
                >;
            }
        } catch { }

        try {
            const parsed = JSON.parse(
                extracted
                    .replace(/\\"/g, '"')
                    .replace(
                        /\\\\/g,
                        "\\"
                    )
            );

            if (
                parsed &&
                typeof parsed ===
                "object" &&
                !Array.isArray(parsed)
            ) {
                return parsed as Record<
                    string,
                    unknown
                >;
            }
        } catch { }
    }

    return null;
}

function extractNarrative(
    payload: Record<string, unknown>
): string {
    const candidates = [
        payload.narrative,
        payload.text,
        payload.message,
        payload.content,
        payload.output,
        payload.response,
    ];

    for (const value of candidates) {
        if (
            typeof value === "string" &&
            value.trim()
        ) {
            return value.trim();
        }
    }

    return "";
}

function extractArtifacts(
    payload: Record<string, unknown>
): unknown[] {
    const candidates = [
        payload.artifacts,
        payload.cards,
        payload.items,
        payload.widgets,
        payload.blocks,
    ];

    for (const value of candidates) {
        if (Array.isArray(value)) {
            return value.filter(
                (item) =>
                    item &&
                    typeof item === "object"
            );
        }
    }

    return [];
}

export function parseAdvisorResponse(
    rawResponse: string
): AdvisorResponse {
    if (!rawResponse?.trim()) {
        return {
            narrative: "No response",
            artifacts: [],
        };
    }

    try {
        const parsed =
            parseJsonSafely(rawResponse);

        if (parsed) {
            const narrative =
                extractNarrative(parsed);

            const artifacts =
                extractArtifacts(parsed);

            return {
                narrative:
                    narrative ||
                    "No narrative provided",
                artifacts: artifacts as AdvisorArtifact[],
            };
        }
    } catch (error) {
        console.error(
            "Advisor response parse error:",
            error
        );
    }

    return {
        narrative: rawResponse.trim(),
        artifacts: [],
    };
}