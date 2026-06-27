import { NextResponse } from "next/server";

import { prisma } from "../../../../../../src/lib/prisma";
import { findOrCreateCategory } from "../../../../../../src/services/categorizer";
import { getTransactionImpact } from "../../../../../../src/services/balance";

const CREDIT_TYPES = new Set(["CREDIT", "SALARY", "REFUND", "INCOME"]);
const DEBIT_TYPES = new Set(["DEBIT", "TRANSFER", "SUBSCRIPTION", "EXPENSE"]);

type SourceSnapshot = {
    id: string;
    amount: number;
    merchant: string;
    timestamp: string;
    type: string;
    transactionType: string;
    paymentMethod?: string | null;
    bankName?: string | null;
    notes?: string | null;
    category?: string | null;
    source?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json() as { sourceId?: string; transactionType?: string };
        const club = await prisma.transaction.findUnique({ where: { id } });
        if (!club?.isClubbed) return NextResponse.json({ error: "Clubbed transaction not found" }, { status: 404 });

        let sources: SourceSnapshot[] = [];
        try {
            const parsed = JSON.parse(club.clubbedSources);
            if (Array.isArray(parsed)) sources = parsed;
        } catch {
            return NextResponse.json({ error: "Original transaction details are unavailable" }, { status: 409 });
        }
        const source = sources.find((item) => item.id === body.sourceId);
        if (!source) return NextResponse.json({ error: "Original transaction details are unavailable" }, { status: 404 });

        const remaining = sources.filter((item) => item.id !== source.id);
        const remainingImpact = remaining.reduce(
            (total, item) => total + getTransactionImpact(item.amount, item.type, item.transactionType),
            0,
        );
        const requestedType = body.transactionType?.trim().toUpperCase();
        const currentType = club.transactionType || club.type;
        const requiredTypes = remainingImpact >= 0 ? CREDIT_TYPES : DEBIT_TYPES;
        const nextType = remaining.length > 1 ? (requestedType || currentType) : currentType;
        if (remaining.length > 1 && !requiredTypes.has(nextType)) {
            return NextResponse.json({
                error: "The remaining amount changed direction. Select a compatible type.",
                requiresType: true,
                direction: remainingImpact >= 0 ? "credit" : "debit",
            }, { status: 409 });
        }

        const sourceCategory = source.category ? await findOrCreateCategory(source.category) : null;
        const remainingSource = remaining.length === 1 ? remaining[0] : null;
        const remainingCategory = remainingSource?.category ? await findOrCreateCategory(remainingSource.category) : null;
        const sourceImpact = getTransactionImpact(source.amount, source.type, source.transactionType);
        const oldImpact = getTransactionImpact(club.amount, club.type, club.transactionType);
        const newClubImpact = remaining.length > 1
            ? getTransactionImpact(Math.abs(remainingImpact), nextType, nextType)
            : remainingImpact;

        await prisma.$transaction(async (tx) => {
            await tx.transaction.create({
                data: {
                    amount: Math.abs(source.amount),
                    merchant: source.merchant || "Unknown",
                    timestamp: new Date(source.timestamp),
                    type: source.type || source.transactionType || "OTHER",
                    transactionType: source.transactionType || source.type || "OTHER",
                    paymentMethod: source.paymentMethod,
                    bankName: source.bankName,
                    notes: source.notes,
                    categoryId: sourceCategory?.id,
                    source: source.source || "separated",
                    rawText: "",
                    raw: JSON.stringify({ separatedFrom: club.id, originalId: source.id }),
                },
            });
            if (remainingSource) {
                await tx.transaction.create({
                    data: {
                        amount: Math.abs(remainingSource.amount),
                        merchant: remainingSource.merchant || "Unknown",
                        timestamp: new Date(remainingSource.timestamp),
                        type: remainingSource.type || remainingSource.transactionType || "OTHER",
                        transactionType: remainingSource.transactionType || remainingSource.type || "OTHER",
                        paymentMethod: remainingSource.paymentMethod,
                        bankName: remainingSource.bankName,
                        notes: remainingSource.notes,
                        categoryId: remainingCategory?.id,
                        source: remainingSource.source || "separated",
                        rawText: "",
                        raw: JSON.stringify({ separatedFrom: club.id, originalId: remainingSource.id }),
                    },
                });
                await tx.transaction.delete({ where: { id: club.id } });
            } else if (remaining.length > 1) {
                await tx.transaction.update({
                    where: { id: club.id },
                    data: {
                        amount: Math.abs(remainingImpact),
                        type: nextType,
                        transactionType: nextType,
                        clubbedSourceIds: JSON.stringify(remaining.map((item) => item.id)),
                        clubbedSources: JSON.stringify(remaining),
                        raw: JSON.stringify({ clubbedSourceIds: remaining.map((item) => item.id) }),
                    },
                });
            } else {
                await tx.transaction.delete({ where: { id: club.id } });
            }
            const delta = sourceImpact + newClubImpact - oldImpact;
            if (delta !== 0) {
                await tx.financialProfile.update({
                    where: { id: "default" },
                    data: { balance: { increment: delta } },
                });
            }
        });
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
