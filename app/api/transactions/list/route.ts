import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

type TransactionRow = {
    category_id: string | null;
    category_name: string | null;
    category_description: string | null;
    category_createdAt: string | number | Date | null;
    category_updatedAt: string | number | Date | null;
    [key: string]: unknown;
};

export async function GET() {
    try {
        const rows = await prisma.$queryRaw<TransactionRow[]>`
            SELECT
                t.*,
                c.id as category_id,
                c.name as category_name,
                c.description as category_description,
                c.createdAt as category_createdAt,
                c.updatedAt as category_updatedAt
            FROM "Transaction" t
            LEFT JOIN "Category" c ON c.id = t.categoryId
            ORDER BY t.timestamp DESC
            LIMIT 200
        `;
        const txs = rows.map((row) => ({
            ...row,
            category: row.category_id ? {
                id: row.category_id,
                name: row.category_name,
                description: row.category_description,
                createdAt: row.category_createdAt,
                updatedAt: row.category_updatedAt,
            } : null,
        }));
        return NextResponse.json({ ok: true, transactions: txs });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
