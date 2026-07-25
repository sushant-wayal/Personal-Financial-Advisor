import { prisma } from "../lib/prisma";
import { CREDIT_TYPES } from "./balance";

export async function getEnrichedBudgets() {
  const budgets = await prisma.categoryBudget.findMany({
    include: {
      category: true,
    },
  });

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

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
              lte: currentMonthEnd,
            },
            NOT: {
              OR: [
                { transactionType: { in: Array.from(CREDIT_TYPES) } },
                { type: { in: Array.from(CREDIT_TYPES) } },
              ]
            }
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
        const agg = await prisma.transaction.aggregate({
          where: {
            categoryId: budget.categoryId,
            timestamp: {
              gte: currentMonthStart,
              lte: currentMonthEnd,
            },
            NOT: {
              OR: [
                { transactionType: { in: Array.from(CREDIT_TYPES) } },
                { type: { in: Array.from(CREDIT_TYPES) } },
              ]
            }
          },
          _sum: {
            amount: true,
          },
        });

        const spent = Math.abs(agg._sum.amount || 0);

        return {
          ...budget,
          spent: spent,
          available: budget.monthlyLimit - spent,
          totalLimit: budget.monthlyLimit,
          currentMonthLimit: budget.monthlyLimit,
        };
      }
    })
  );

  return enrichedBudgets;
}
