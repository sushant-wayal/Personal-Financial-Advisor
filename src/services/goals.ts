import { prisma } from "../lib/prisma";

export async function listGoals() {
    return prisma.goal.findMany({ orderBy: { priority: "asc" } });
}

export async function createGoal(data: { title: string; targetAmount: number; targetDate?: string; priority?: number; notes?: string }) {
    return prisma.goal.create({ data: { title: data.title, targetAmount: data.targetAmount, targetDate: data.targetDate ? new Date(data.targetDate) : null, priority: data.priority ?? 3, notes: data.notes } });
}

export async function updateGoal(id: string, patch: Partial<{ title: string; targetAmount: number; currentAmount: number; monthlyTarget: number; targetDate: string; priority: number; notes: string }>) {
    const data: any = { ...patch };
    if (patch.targetDate) data.targetDate = new Date(patch.targetDate as string);
    return prisma.goal.update({ where: { id }, data });
}

export function recommendMonthlyContribution(currentAmount: number, targetAmount: number, monthsLeft: number) {
    if (monthsLeft <= 0) return targetAmount - currentAmount;
    return Math.max(0, (targetAmount - currentAmount) / monthsLeft);
}

export function predictETA(currentAmount: number, monthlyContribution: number, targetAmount: number) {
    if (monthlyContribution <= 0) return null;
    const months = Math.ceil((targetAmount - currentAmount) / monthlyContribution);
    const now = new Date();
    const eta = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    return { months, eta };
}
