import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
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

type IngestionKeyInput = {
    source?: string | null;
    sourceMessageId?: string | null;
    amount: number;
    merchant: string;
    timestamp: Date;
    transactionType?: string | null;
};

function toDate(value?: string | Date) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeKeyPart(value?: string | null) {
    return String(value || "unknown")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ") || "unknown";
}

function hashKey(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

export function buildTransactionIngestionKeys(input: IngestionKeyInput) {
    const source = normalizeKeyPart(input.source);
    const fingerprint = [
        "tx:v1",
        source,
        normalizeKeyPart(input.merchant),
        Math.abs(input.amount || 0).toFixed(2),
        input.timestamp.toISOString(),
        String(input.transactionType || "OTHER").toUpperCase(),
    ].join(":");

    const keys = [fingerprint];
    if (input.sourceMessageId) {
        keys.unshift(`message:${source}:${String(input.sourceMessageId)}`);
    }
    return keys;
}

function getIngestionKeyModel(client: any = prisma) {
    const model = client.transactionIngestionKey;
    if (!model) throw new Error("transaction ingestion key model not available");
    return model;
}

async function findTransactionById(transactionId?: string | null) {
    if (!transactionId) return null;
    return prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { category: true },
    });
}

async function findExistingIngestionKey(keys: string[]) {
    if (!keys.length) return null;
    return getIngestionKeyModel().findFirst({
        where: { key: { in: keys } },
        orderBy: { createdAt: "asc" },
    });
}

function isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function skipExistingIngestion(keys: string[]) {
    const existingKey = await findExistingIngestionKey(keys);
    if (!existingKey) return null;

    const existingTransaction = await findTransactionById(existingKey.transactionId);
    console.info("[transaction-ingestion] duplicate ingestion key skipped", {
        key: existingKey.key,
        status: existingKey.status,
        transactionId: existingKey.transactionId,
    });

    return {
        ok: true,
        duplicate: true,
        skipped: !existingTransaction,
        reason: existingKey.reason || "duplicate-ingestion-key",
        transaction: existingTransaction,
    };
}

async function reserveIngestionKey(args: { key: string; source: string; sourceMessageId?: string | null }) {
    const model = getIngestionKeyModel();
    try {
        return await model.create({
            data: {
                id: `tik_${hashKey(args.key).slice(0, 32)}`,
                key: args.key,
                source: args.source,
                sourceMessageId: args.sourceMessageId || null,
                status: "PROCESSING",
            },
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        return model.findUnique({ where: { key: args.key } });
    }
}

async function recordIngestionKeys(args: {
    keys: string[];
    source: string;
    sourceMessageId?: string | null;
    transactionId?: string | null;
    status?: string;
    reason?: string | null;
}) {
    const model = getIngestionKeyModel();
    const now = new Date();
    await model.createMany({
        data: args.keys.map((key) => ({
            id: `tik_${hashKey(key).slice(0, 32)}`,
            key,
            source: args.source,
            sourceMessageId: args.sourceMessageId || null,
            transactionId: args.transactionId || null,
            status: args.status || "RECORDED",
            reason: args.reason || null,
            createdAt: now,
            updatedAt: now,
        })),
        skipDuplicates: true,
    });
    await model.updateMany({
        where: { key: { in: args.keys } },
        data: {
            transactionId: args.transactionId || null,
            status: args.status || "RECORDED",
            reason: args.reason || null,
            sourceMessageId: args.sourceMessageId || null,
        },
    });
}

async function applyTransactionSideEffects(amount: number, transactionType: string) {
    console.info("[transaction-ingestion] applying side effects", { amount, transactionType });
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
    return transactionModel.findFirst({ where: { sourceMessageId }, include: { category: true } });
}

export async function ingestTransaction(input: TransactionIngestionInput) {
    const raw = input.raw || input.rawText || JSON.stringify(input);
    const sourceMessageId = input.sourceMessageId ? String(input.sourceMessageId) : null;

    console.info("[transaction-ingestion] start", {
        source: input.source,
        sourceMessageId,
        hasStructuredFields: Boolean(
            input.amount !== undefined ||
            input.merchant !== undefined ||
            input.category !== undefined ||
            input.categoryId !== undefined ||
            input.transactionType !== undefined ||
            input.type !== undefined ||
            input.paymentMethod !== undefined ||
            input.bankName !== undefined ||
            input.notes !== undefined ||
            input.timestamp !== undefined,
        ),
        rawLength: raw.length,
    });

    if (sourceMessageId) {
        const existing = await findTransactionBySourceMessageId(sourceMessageId);
        if (existing) {
            const source = input.source || existing.source || "email";
            await recordIngestionKeys({
                keys: buildTransactionIngestionKeys({
                    source,
                    sourceMessageId,
                    amount: existing.amount,
                    merchant: existing.merchant,
                    timestamp: existing.timestamp,
                    transactionType: existing.transactionType || existing.type || "OTHER",
                }),
                source,
                sourceMessageId,
                transactionId: existing.id,
            });
            console.info("[transaction-ingestion] duplicate sourceMessageId skipped", { sourceMessageId, transactionId: existing.id });
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

        if (!Number.isFinite(amount) || amount <= 0) {
            console.warn("[transaction-ingestion] structured transaction skipped because amount is invalid", {
                amount: input.amount,
                merchant: input.merchant,
                sourceMessageId,
            });
            return { ok: false, skipped: true, reason: "invalid-amount" };
        }

        const merchant = String(input.merchant || "").trim() || "Unknown";
        const timestamp = toDate(input.timestamp) || new Date();
        let transactionType = String(input.transactionType || input.type || "OTHER").toUpperCase();

        if (amountWasNegative && !input.transactionType && !input.type) {
            transactionType = "DEBIT";
        }

        const source = input.source || "manual";
        const ingestionKeys = buildTransactionIngestionKeys({
            source,
            sourceMessageId,
            amount,
            merchant,
            timestamp,
            transactionType,
        });
        const duplicate = await skipExistingIngestion(ingestionKeys);
        if (duplicate) return duplicate;

        const reservation = await reserveIngestionKey({
            key: ingestionKeys[0],
            source,
            sourceMessageId,
        });
        if (reservation?.status !== "PROCESSING" || reservation?.transactionId) {
            return await skipExistingIngestion(ingestionKeys) || {
                ok: true,
                duplicate: true,
                skipped: true,
                reason: "duplicate-ingestion-key",
            };
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

        console.info("[transaction-ingestion] creating structured transaction", {
            merchant,
            amount,
            transactionType,
            categoryId,
            sourceMessageId,
        });

        const tx = await prisma.transaction.create({
            data: {
                amount: Number.isFinite(amount) ? amount : 0,
                merchant,
                categoryId,
                timestamp,
                source,
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

        console.info("[transaction-ingestion] created structured transaction", { transactionId: tx.id, merchant: tx.merchant });

        await recordIngestionKeys({
            keys: ingestionKeys,
            source,
            sourceMessageId,
            transactionId: tx.id,
        });

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
    console.info("[transaction-ingestion] parsed email text", {
        merchant: parsed.merchant,
        amount: parsed.amount,
        type: parsed.type,
        transactionType: parsed.transactionType,
    });
    const normalizedAmount = Math.abs(parsed.amount);
    const parsedTimestamp = parsed.timestamp && !isNaN(new Date(parsed.timestamp).getTime())
        ? new Date(parsed.timestamp)
        : toDate(input.timestamp) || new Date();
    const parsedTransactionType = parsed.transactionType || parsed.type || "OTHER";
    const source = input.source || parsed.source || "email";
    const ingestionKeys = buildTransactionIngestionKeys({
        source,
        sourceMessageId,
        amount: normalizedAmount,
        merchant: parsed.merchant,
        timestamp: parsedTimestamp,
        transactionType: parsedTransactionType,
    });

    const duplicate = await skipExistingIngestion(ingestionKeys);
    if (duplicate) return duplicate;

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
        console.warn("[transaction-ingestion] parsed transaction skipped because amount is missing", {
            merchant: parsed.merchant,
            source,
            sourceMessageId,
        });
        await recordIngestionKeys({
            keys: ingestionKeys,
            source,
            sourceMessageId,
            status: "SKIPPED",
            reason: "missing-amount",
        });
        return { ok: true, skipped: true, reason: "missing-amount" };
    }

    const reservation = await reserveIngestionKey({
        key: ingestionKeys[0],
        source,
        sourceMessageId,
    });
    if (reservation?.status !== "PROCESSING" || reservation?.transactionId) {
        return await skipExistingIngestion(ingestionKeys) || {
            ok: true,
            duplicate: true,
            skipped: true,
            reason: "duplicate-ingestion-key",
        };
    }

    const catInfo = await autoCategorize(parsed.merchant, {
        rawText: parsed.rawText || raw,
        transactionType: parsed.transactionType,
        fallback: parsed.category,
    });
    const category = await findOrCreateCategory(catInfo.category);

    const tx = await prisma.transaction.create({
        data: {
            amount: normalizedAmount,
            merchant: parsed.merchant,
            categoryId: category.id,
            timestamp: parsedTimestamp,
            source,
            sourceMessageId: sourceMessageId || undefined,
            account: parsed.account || null,
            type: parsed.type || "OTHER",
            notes: parsed.notes || null,
            confidence: Math.min(parsed.confidence ?? 0.6, catInfo.confidence),
            raw: parsed.raw || raw,
        } as any,
        include: { category: true },
    });

    console.info("[transaction-ingestion] created parsed transaction", {
        transactionId: tx.id,
        merchant: tx.merchant,
        amount: tx.amount,
        sourceMessageId,
    });

    await prisma.$executeRaw`
        UPDATE "Transaction"
        SET "paymentMethod" = ${parsed.paymentMethod || null},
            "bankName" = ${parsed.bankName || null},
            "transactionType" = ${parsed.transactionType || parsed.type || "OTHER"},
            "rawText" = ${parsed.rawText || raw}
        WHERE "id" = ${tx.id}
    `;

    await recordIngestionKeys({
        keys: ingestionKeys,
        source,
        sourceMessageId,
        transactionId: tx.id,
    });

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
