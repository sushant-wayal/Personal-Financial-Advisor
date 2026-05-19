import { NextResponse } from "next/server";

import { getTransactions, type TransactionSort } from "@/src/services/transactions";

const VALID_SORT_FIELDS = new Set(["date", "amount", "merchant", "category", "type"]);

function parseNumber(value: string | null) {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
}

function parseSortParam(value: string | null): TransactionSort[] | undefined {
    if (!value) return undefined;
    const entries = value
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
            const divider = chunk.includes(":") ? ":" : "_";
            const [idRaw, directionRaw] = chunk.split(divider);
            const id = idRaw?.trim();
            if (!id || !VALID_SORT_FIELDS.has(id)) return null;
            const direction = directionRaw?.trim().toLowerCase();
            return {
                id: id as TransactionSort["id"],
                desc: direction === "desc",
            };
        })
        .filter((entry): entry is TransactionSort => Boolean(entry));

    return entries.length ? entries : undefined;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseNumber(searchParams.get("page"));
        const pageSize = parseNumber(searchParams.get("pageSize"));
        const search = searchParams.get("search") || undefined;
        const category = searchParams.get("category") || undefined;
        const type = searchParams.get("type") || undefined;
        const dateRange = searchParams.get("dateRange") || undefined;
        const dateFrom = searchParams.get("dateFrom") || undefined;
        const dateTo = searchParams.get("dateTo") || undefined;
        const amountMin = parseNumber(searchParams.get("amountMin"));
        const amountMax = parseNumber(searchParams.get("amountMax"));
        const merchant = searchParams.get("merchant") || undefined;
        const sort = parseSortParam(searchParams.get("sort"));

        const queryInput = {
            page,
            pageSize,
            search,
            category,
            type,
            dateRange,
            dateFrom,
            dateTo,
            amountMin,
            amountMax,
            merchant,
            sort,
        };

        const result = await getTransactions(queryInput);

        return NextResponse.json({
            ...result,
            transactions: result.data,
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("transactions list error", { message, error: e });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
