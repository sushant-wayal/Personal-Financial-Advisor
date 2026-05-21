import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

const CREDIT_TYPES = new Set(["CREDIT", "CREDITED", "SALARY", "REFUND", "INCOME"]);
const DEBIT_TYPES = new Set([
    "DEBIT",
    "DEBITED",
    "EXPENSE",
    "PURCHASE",
    "WITHDRAWAL",
    "CHARGE",
    "BILL",
    "PAYMENT",
    "SUBSCRIPTION",
    "TRANSFER",
]);

function normalizeType(value?: string | null) {
    return (value || "").toString().toUpperCase();
}

export function getTransactionImpact(amount: number, type?: string | null, transactionType?: string | null) {
    const normalized = normalizeType(transactionType || type);
    const normalizedAmount = Math.abs(amount || 0);

    if (CREDIT_TYPES.has(normalized)) return normalizedAmount;
    if (DEBIT_TYPES.has(normalized)) return -normalizedAmount;
    return -normalizedAmount;
}

export async function updateProfileBalanceBy(delta: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    await prisma.financialProfile.update({
        where: { id: "default" },
        data: { balance: { increment: delta } },
    });
}

export async function getTransactionsNetImpact(where?: Prisma.TransactionWhereInput) {
    const creditSum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
            AND: [
                where ?? {},
                {
                    OR: [
                        { transactionType: { in: Array.from(CREDIT_TYPES) } },
                        { type: { in: Array.from(CREDIT_TYPES) } },
                    ],
                },
            ],
        },
    });

    const totalSum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: where ?? {},
    });

    const credits = Math.abs(creditSum._sum.amount ?? 0);
    const total = Math.abs(totalSum._sum.amount ?? 0);
    const debits = Math.max(0, total - credits);
    return credits - debits;
}

export async function getLastMonthNetImpact() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    return getTransactionsNetImpact({
        timestamp: {
            gte: startOfLastMonth,
            lt: startOfThisMonth,
        },
    });
}

export async function getCurrentMonthNetImpact() {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return getTransactionsNetImpact({
        timestamp: {
            gte: startOfThisMonth,
            lt: now,
        },
    });
}
