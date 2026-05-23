import { prisma } from "../lib/prisma";
import { deterministicParse } from "./transactionParser";
import { autoCategorize, findOrCreateCategory } from "./categorizer";
import { getTransactionImpact, updateProfileBalanceBy } from "./balance";
import { adviseGoals } from "./GoalAdvisorService";
import { getGoalOverview } from "./goals";

type TransactionIngestionInput = {
    raw?: string;
    rawText?: string;
    amount?: number | string;
    merchant?: string;
    category?: string;
    categoryId?: string;
    transactionType?: string;
    type?: string;
    paymentMethod?: string;
    bankName?: string;
    notes?: string;
    timestamp?: string | Date;
    confidence?: number;
    source?: string;
    sourceMessageId?: string | null;
};

function toDate(value?: string | Date) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

async function applyTransactionSideEffects(amount: number, transactionType: string) {
    const impact = getTransactionImpact(amount, transactionType, transactionType);
    await updateProfileBalanceBy(impact);

    try {
        await getGoalOverview();
        await adviseGoals({ persist: true });
    } catch (error) {
        console.error("goal recalculation failed", error);
    }
}

async function findTransactionBySourceMessageId(sourceMessageId: string) {
    const transactionModel = (prisma as any).transaction;
    if (!transactionModel) {
        throw new Error("transaction model not available");
    }
    return transactionModel.findFirst({ where: { sourceMessageId } });
}

export async function ingestTransaction(input: TransactionIngestionInput) {
    const raw = input.raw || input.rawText || JSON.stringify(input);
    const sourceMessageId = input.sourceMessageId ? String(input.sourceMessageId) : null;

    if (sourceMessageId) {
        const existing = await findTransactionBySourceMessageId(sourceMessageId);
        if (existing) {
            return { ok: true, duplicate: true, transaction: existing };
        }
    }

    const hasStructuredFields =
        input.amount !== undefined ||
        input.merchant !== undefined ||
        input.category !== undefined ||
        input.categoryId !== undefined ||
        input.transactionType !== undefined ||
        input.type !== undefined ||
        input.paymentMethod !== undefined ||
        input.bankName !== undefined ||
        input.notes !== undefined ||
        input.timestamp !== undefined;

    if (hasStructuredFields && (input.amount !== undefined || input.merchant)) {
        let amount = Number(input.amount);
        const amountWasNegative = amount < 0;
        amount = Math.abs(amount);

        const merchant = String(input.merchant || "").trim() || "Unknown";
        const timestamp = toDate(input.timestamp) || new Date();
        let transactionType = String(input.transactionType || input.type || "OTHER").toUpperCase();

        if (amountWasNegative && !input.transactionType && !input.type) {
            transactionType = "DEBIT";
        }

        let categoryId: string | null = null;

        if (input.categoryId) {
            const existing = await prisma.category.findUnique({ where: { id: String(input.categoryId) } });
            categoryId = existing?.id || null;
        }

        if (!categoryId && input.category) {
            const category = await findOrCreateCategory(String(input.category));
            categoryId = category.id;
        }

        if (!categoryId) {
            const catInfo = await autoCategorize(merchant, {
                rawText: input.rawText || raw,
                transactionType,
                fallback: input.category,
            });
            const category = await findOrCreateCategory(catInfo.category);
            categoryId = category.id;
        }

        const tx = await prisma.transaction.create({
            data: {
                amount: Number.isFinite(amount) ? amount : 0,
                merchant,
                categoryId,
                timestamp,
                source: input.source || "manual",
                sourceMessageId: sourceMessageId || undefined,
                type: transactionType,
                notes: input.notes || null,
                confidence: typeof input.confidence === "number" ? Math.min(input.confidence, 1) : 1,
                raw,
            } as any,
            include: { category: true },
        });

        await prisma.$executeRaw`
            UPDATE "Transaction"
            SET "paymentMethod" = ${input.paymentMethod || null},
                "bankName" = ${input.bankName || null},
                "transactionType" = ${transactionType},
                "rawText" = ${input.rawText || raw}
            WHERE "id" = ${tx.id}
        `;

        await applyTransactionSideEffects(tx.amount, transactionType);

        return {
            ok: true,
            transaction: {
                ...tx,
                paymentMethod: input.paymentMethod || null,
                bankName: input.bankName || null,
                transactionType,
                rawText: input.rawText || raw,
            },
        };
    }

    const parsed = deterministicParse(raw);
    const catInfo = await autoCategorize(parsed.merchant, {
        rawText: parsed.rawText || raw,
        transactionType: parsed.transactionType,
        fallback: parsed.category,
    });
    const category = await findOrCreateCategory(catInfo.category);
    const normalizedAmount = Math.abs(parsed.amount);

    const tx = await prisma.transaction.create({
        data: {
            amount: normalizedAmount,
            merchant: parsed.merchant,
            categoryId: category.id,
            timestamp: parsed.timestamp && !isNaN(new Date(parsed.timestamp).getTime()) ? new Date(parsed.timestamp) : new Date(),
            source: input.source || parsed.source || "email",
            sourceMessageId: sourceMessageId || undefined,
            account: parsed.account || null,
            type: parsed.type || "OTHER",
            notes: parsed.notes || null,
            confidence: Math.min(parsed.confidence ?? 0.6, catInfo.confidence),
            raw: parsed.raw || raw,
        } as any,
        include: { category: true },
    });

    await prisma.$executeRaw`
        UPDATE "Transaction"
        SET "paymentMethod" = ${parsed.paymentMethod || null},
            "bankName" = ${parsed.bankName || null},
            "transactionType" = ${parsed.transactionType || parsed.type || "OTHER"},
            "rawText" = ${parsed.rawText || raw}
        WHERE "id" = ${tx.id}
    `;

    await applyTransactionSideEffects(tx.amount, parsed.type || parsed.transactionType || "OTHER");

    return {
        ok: true,
        transaction: {
            ...tx,
            paymentMethod: parsed.paymentMethod || null,
            bankName: parsed.bankName || null,
            transactionType: parsed.transactionType || parsed.type || "OTHER",
            rawText: parsed.rawText || raw,
        },
    };
}
