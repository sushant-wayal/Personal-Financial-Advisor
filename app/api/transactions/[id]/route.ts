import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { findOrCreateCategory, teachMerchantCategory } from "../../../../src/services/categorizer";

type UpdateBody = {
    merchant?: string;
    category?: string;
    amount?: number | string;
    timestamp?: string;
    paymentMethod?: string | null;
    bankName?: string | null;
    transactionType?: string;
    notes?: string | null;
};

function cleanOptional(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json() as UpdateBody;

        const amount = body.amount === undefined ? undefined : Number(body.amount);
        if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
            return NextResponse.json({ error: "invalid amount" }, { status: 400 });
        }

        const timestamp = body.timestamp ? new Date(body.timestamp) : undefined;
        if (timestamp && Number.isNaN(timestamp.getTime())) {
            return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
        }

        const category = body.category ? await findOrCreateCategory(body.category) : undefined;
        const transactionType = body.transactionType?.trim().toUpperCase() || undefined;

        const tx = await prisma.transaction.update({
            where: { id },
            data: {
                ...(body.merchant !== undefined ? { merchant: body.merchant.trim() || "Unknown" } : {}),
                ...(amount !== undefined ? { amount } : {}),
                ...(timestamp ? { timestamp } : {}),
                ...(category ? { categoryId: category.id } : {}),
                ...(transactionType ? { type: transactionType } : {}),
                ...(body.notes !== undefined ? { notes: cleanOptional(body.notes) } : {}),
                confidence: category ? 0.98 : undefined,
            },
            include: { category: true },
        });

        await prisma.$executeRaw`
            UPDATE "Transaction"
            SET "paymentMethod" = ${cleanOptional(body.paymentMethod)},
                "bankName" = ${cleanOptional(body.bankName)},
                "transactionType" = ${transactionType || tx.type}
            WHERE "id" = ${id}
        `;

        if (category) {
            await teachMerchantCategory(tx.merchant, category.name);
        }

        return NextResponse.json({ ok: true, transaction: tx });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await prisma.transaction.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
