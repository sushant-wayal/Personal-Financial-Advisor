import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";
import { findOrCreateCategory } from "../../../../src/services/categorizer";
import { getTransactionImpact } from "../../../../src/services/balance";

const CREDIT_TYPES = new Set(["CREDIT", "SALARY", "REFUND", "INCOME"]);
const DEBIT_TYPES = new Set(["DEBIT", "TRANSFER", "SUBSCRIPTION", "EXPENSE"]);

type ClubBody = {
    transactionIds?: unknown;
    merchant?: unknown;
    category?: unknown;
    paymentMethod?: unknown;
    bankName?: unknown;
    transactionType?: unknown;
    notes?: unknown;
};

function requiredText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
    const valueText = requiredText(value);
    return valueText || null;
}

export async function POST(req: Request) {
    try {
        const body = await req.json() as ClubBody;
        const ids = Array.isArray(body.transactionIds)
            ? Array.from(new Set(body.transactionIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))))
            : [];

        if (ids.length < 2) {
            return NextResponse.json({ error: "Select at least two transactions" }, { status: 400 });
        }

        const merchant = requiredText(body.merchant);
        const categoryName = requiredText(body.category);
        const transactionType = requiredText(body.transactionType).toUpperCase();
        const paymentMethod = requiredText(body.paymentMethod);

        if (!merchant || !categoryName || !transactionType || !paymentMethod) {
            return NextResponse.json({ error: "Merchant, category, method, and type are required" }, { status: 400 });
        }

        const selected = await prisma.transaction.findMany({
            where: { id: { in: ids } },
            include: { category: true },
        });
        if (selected.length !== ids.length) {
            return NextResponse.json({ error: "One or more selected transactions no longer exist" }, { status: 409 });
        }
        const signedTotal = selected.reduce(
            (total, transaction) => total + getTransactionImpact(transaction.amount, transaction.type, transaction.transactionType),
            0,
        );
        if (Math.abs(signedTotal) < 0.005) {
            return NextResponse.json({ error: "These transactions cancel each other out" }, { status: 400 });
        }
        const eligibleTypes = signedTotal > 0 ? CREDIT_TYPES : DEBIT_TYPES;
        if (!eligibleTypes.has(transactionType)) {
            return NextResponse.json({
                error: signedTotal > 0
                    ? "A positive club requires a credit or income type"
                    : "A negative club requires a debit or expense type",
            }, { status: 400 });
        }

        const latestTimestamp = selected.reduce(
            (latest, transaction) => transaction.timestamp > latest ? transaction.timestamp : latest,
            selected[0].timestamp,
        );
        const category = await findOrCreateCategory(categoryName);
        const sourceIds = Array.from(new Set(selected.flatMap((transaction) => {
            if (!transaction.isClubbed) return [transaction.id];
            try {
                const parsed = JSON.parse(transaction.clubbedSourceIds);
                return Array.isArray(parsed)
                    ? parsed.filter((id): id is string => typeof id === "string" && Boolean(id))
                    : [transaction.id];
            } catch {
                return [transaction.id];
            }
        })));
        const previousImpact = selected.reduce(
            (total, transaction) => total + getTransactionImpact(transaction.amount, transaction.type, transaction.transactionType),
            0,
        );
        const nextImpact = getTransactionImpact(Math.abs(signedTotal), transactionType, transactionType);

        const clubbed = await prisma.$transaction(async (tx) => {
            await tx.transaction.deleteMany({ where: { id: { in: ids } } });
            const transaction = await tx.transaction.create({
                data: {
                    amount: Math.abs(signedTotal),
                    merchant,
                    categoryId: category.id,
                    paymentMethod,
                    bankName: optionalText(body.bankName),
                    timestamp: latestTimestamp,
                    source: "clubbed",
                    transactionType,
                    type: transactionType,
                    notes: optionalText(body.notes),
                    confidence: 1,
                    rawText: "",
                    raw: JSON.stringify({ clubbedSourceIds: sourceIds }),
                    isClubbed: true,
                    clubbedSourceIds: JSON.stringify(sourceIds),
                },
                include: { category: true },
            });

            const balanceDelta = nextImpact - previousImpact;
            if (balanceDelta !== 0) {
                await tx.financialProfile.update({
                    where: { id: "default" },
                    data: { balance: { increment: balanceDelta } },
                });
            }
            return transaction;
        });

        return NextResponse.json({ ok: true, transaction: clubbed });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("transaction clubbing failed", { message, error });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
