import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CREDIT_TYPES } from "./balance";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

/**
 * Checks whether a transaction type is eligible to be tagged as spending against a goal.
 * Only debit/expense/spending transactions are eligible. Income/credit transactions are not.
 */
export function isEligibleGoalTransaction(type?: string | null, transactionType?: string | null): boolean {
    const raw = (transactionType || type || "").trim().toUpperCase();
    if (!raw) return true; // Default transaction in the system is debit/expense
    return !CREDIT_TYPES.has(raw);
}

/**
 * Deducts spent amount from the goal's currentAmount and targetAmount, and tracks spentAmount.
 */
export async function applyGoalSpending(
    goalId: string,
    amount: number,
    client: PrismaClientOrTx = prisma,
): Promise<void> {
    const cleanAmount = Math.abs(amount || 0);
    if (!goalId || cleanAmount <= 0) return;

    const goal = await client.goal.findUnique({
        where: { id: goalId },
        select: { id: true, currentAmount: true, targetAmount: true, spentAmount: true },
    });
    if (!goal) return;

    const newSpent = Number(((goal.spentAmount || 0) + cleanAmount).toFixed(2));
    const newCurrent = Math.max(0, Number((goal.currentAmount - cleanAmount).toFixed(2)));
    const newTarget = Math.max(0, Number((goal.targetAmount - cleanAmount).toFixed(2)));

    await client.goal.update({
        where: { id: goalId },
        data: {
            spentAmount: newSpent,
            currentAmount: newCurrent,
            targetAmount: newTarget,
        },
    });
}

/**
 * Reverts spent amount from the goal's currentAmount and targetAmount (e.g. on tx delete or goal detachment).
 */
export async function revertGoalSpending(
    goalId: string,
    amount: number,
    client: PrismaClientOrTx = prisma,
): Promise<void> {
    const cleanAmount = Math.abs(amount || 0);
    if (!goalId || cleanAmount <= 0) return;

    const goal = await client.goal.findUnique({
        where: { id: goalId },
        select: { id: true, currentAmount: true, targetAmount: true, spentAmount: true },
    });
    if (!goal) return;

    const newSpent = Math.max(0, Number(((goal.spentAmount || 0) - cleanAmount).toFixed(2)));
    const newCurrent = Number((goal.currentAmount + cleanAmount).toFixed(2));
    const newTarget = Number((goal.targetAmount + cleanAmount).toFixed(2));

    await client.goal.update({
        where: { id: goalId },
        data: {
            spentAmount: newSpent,
            currentAmount: newCurrent,
            targetAmount: newTarget,
        },
    });
}

export type GoalSpendingTransitionParams = {
    oldGoalId?: string | null;
    newGoalId?: string | null;
    oldAmount: number;
    newAmount: number;
    oldIsEligible: boolean;
    newIsEligible: boolean;
    client?: PrismaClientOrTx;
};

/**
 * Recalibrates goal amounts when a transaction's goal, amount, or eligibility is edited.
 */
export async function handleGoalSpendingTransition({
    oldGoalId,
    newGoalId,
    oldAmount,
    newAmount,
    oldIsEligible,
    newIsEligible,
    client = prisma,
}: GoalSpendingTransitionParams): Promise<void> {
    const effectiveOldGoalId = oldIsEligible && oldGoalId ? oldGoalId.trim() : null;
    const effectiveNewGoalId = newIsEligible && newGoalId ? newGoalId.trim() : null;
    const cleanOldAmount = Math.abs(oldAmount || 0);
    const cleanNewAmount = Math.abs(newAmount || 0);

    // Case 1: Both had no goal attached
    if (!effectiveOldGoalId && !effectiveNewGoalId) {
        return;
    }

    // Case 2: Same goal remained attached
    if (effectiveOldGoalId === effectiveNewGoalId && effectiveOldGoalId) {
        const delta = Number((cleanNewAmount - cleanOldAmount).toFixed(2));
        if (delta === 0) return;

        const goal = await client.goal.findUnique({
            where: { id: effectiveOldGoalId },
            select: { id: true, currentAmount: true, targetAmount: true, spentAmount: true },
        });
        if (!goal) return;

        const newSpent = Math.max(0, Number(((goal.spentAmount || 0) + delta).toFixed(2)));
        const newCurrent = Math.max(0, Number((goal.currentAmount - delta).toFixed(2)));
        const newTarget = Math.max(0, Number((goal.targetAmount - delta).toFixed(2)));

        await client.goal.update({
            where: { id: effectiveOldGoalId },
            data: {
                spentAmount: newSpent,
                currentAmount: newCurrent,
                targetAmount: newTarget,
            },
        });
        return;
    }

    // Case 3: Goal changed, or detached, or attached from none
    if (effectiveOldGoalId) {
        await revertGoalSpending(effectiveOldGoalId, cleanOldAmount, client);
    }
    if (effectiveNewGoalId) {
        await applyGoalSpending(effectiveNewGoalId, cleanNewAmount, client);
    }
}

