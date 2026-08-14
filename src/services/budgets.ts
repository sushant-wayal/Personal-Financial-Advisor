import { prisma } from "../lib/prisma";
import { CREDIT_TYPES } from "./balance";

export async function getEnrichedBudgets() {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [budgets, currentMonthSpends] = await Promise.all([
    prisma.categoryBudget.findMany({
      select: {
        id: true,
        categoryId: true,
        monthlyLimit: true,
        rollover: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        timestamp: { gte: currentMonthStart },
        NOT: {
          OR: [
            { transactionType: { in: Array.from(CREDIT_TYPES) } },
            { type: { in: Array.from(CREDIT_TYPES) } },
          ],
        },
      },
      _sum: { amount: true },
    }),
  ]);

  if (budgets.length === 0) return [];

  const currentMonthSpendMap = new Map<string, number>();
  for (const item of currentMonthSpends) {
    if (item.categoryId) {
      currentMonthSpendMap.set(item.categoryId, Math.abs(item._sum.amount ?? 0));
    }
  }

  const enrichedBudgets = await Promise.all(
    budgets.map(async (budget) => {
      if (budget.rollover) {
        const startDate = new Date(budget.createdAt);
        const startMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        let totalMonths = (now.getFullYear() - startMonth.getFullYear()) * 12 + (now.getMonth() - startMonth.getMonth()) + 1;
        if (totalMonths < 1) totalMonths = 1;

        const totalLimit = totalMonths * budget.monthlyLimit;

        const agg = await prisma.transaction.aggregate({
          where: {
            categoryId: budget.categoryId,
            timestamp: {
              gte: startMonth,
            },
            NOT: {
              OR: [
                { transactionType: { in: Array.from(CREDIT_TYPES) } },
                { type: { in: Array.from(CREDIT_TYPES) } },
              ],
            },
          },
          _sum: {
            amount: true,
          },
        });

        const totalSpend = Math.abs(agg._sum.amount || 0);

        return {
          ...budget,
          spent: totalSpend,
          available: totalLimit - totalSpend,
          totalLimit: totalLimit,
          currentMonthLimit: budget.monthlyLimit,
        };
      } else {
        const spent = currentMonthSpendMap.get(budget.categoryId) ?? 0;
        return {
          ...budget,
          spent,
          available: budget.monthlyLimit - spent,
          totalLimit: budget.monthlyLimit,
          currentMonthLimit: budget.monthlyLimit,
        };
      }
    })
  );

  return enrichedBudgets;
}
