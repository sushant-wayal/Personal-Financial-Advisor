import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import {
  calculateCurrentBalance,
  calculateMonthlySavingsRate,
  calculateBurnRate,
  calculateRunway,
  monthlyTrend,
  categoryBreakdown,
  spendingHeatmap,
  seasonalPatterns,
  spendingAcceleration,
} from "@/src/services/analytics";
import { getLast30DaysNetImpact } from "@/src/services/balance";
import { listInsights } from "@/src/services/insights";
import { getEnrichedBudgets } from "@/src/services/budgets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      balanceVal,
      last30DaysDelta,
      savings,
      burn,
      runway,
      monthly,
      categories,
      heatmap,
      seasonality,
      acceleration,
      insights,
      budgets,
      networthSummary,
    ] = await Promise.all([
      calculateCurrentBalance(),
      getLast30DaysNetImpact(),
      calculateMonthlySavingsRate(),
      calculateBurnRate(),
      calculateRunway(),
      monthlyTrend(12),
      categoryBreakdown(30),
      spendingHeatmap(90),
      seasonalPatterns(365),
      spendingAcceleration(5),
      listInsights(50),
      getEnrichedBudgets(),
      (async () => {
        const [
          ppf,
          epf,
          fd,
          rd,
          vehicle,
          plot,
          independentProperty,
          apartment,
          jewellery,
          receivable,
          loan,
          creditCard,
          bnpl,
          borrowed,
          mutualFund,
          stock,
          bankBal,
        ] = await Promise.all([
          prisma.pPFAccount.findMany(),
          prisma.ePFAccount.findMany(),
          prisma.fDAccount.findMany(),
          prisma.rDAccount.findMany(),
          prisma.vehicleAsset.findMany(),
          prisma.plotAsset.findMany(),
          prisma.independentPropertyAsset.findMany(),
          prisma.apartmentAsset.findMany(),
          prisma.jewelleryAsset.findMany(),
          prisma.receivableAsset.findMany(),
          prisma.loanLiability.findMany(),
          prisma.creditCardLiability.findMany(),
          prisma.bnplLiability.findMany(),
          prisma.borrowedLiability.findMany(),
          prisma.mutualFund.findMany(),
          prisma.stock.findMany(),
          calculateCurrentBalance(),
        ]);

        let totalAssets = bankBal;
        let totalLiabilities = 0;

        totalAssets += ppf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += epf.reduce((sum, item) => sum + (item.currentWorth ?? item.currentBalance), 0);
        totalAssets += fd.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);
        totalAssets += rd.reduce((sum, item) => sum + (item.currentWorth ?? item.currentTotalDeposits), 0);
        totalAssets += vehicle.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += plot.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += independentProperty.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += apartment.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += jewellery.reduce((sum, item) => sum + (item.currentWorth ?? (item.purchasePrice || 0)), 0);
        totalAssets += receivable.reduce((sum, item) => sum + (item.currentWorth ?? item.principalAmount), 0);
        totalAssets += mutualFund.reduce((sum, item) => sum + (item.currentWorth ?? ((item.currentUnits || 0) * (item.currentNav || 0))), 0);
        totalAssets += stock.reduce((sum, item) => sum + (item.currentWorth ?? ((item.currentQuantity || 0) * (item.currentPrice || 0))), 0);

        totalLiabilities += loan.reduce((sum, item) => sum + item.outstandingBalance, 0);
        totalLiabilities += creditCard.reduce((sum, item) => sum + item.currentOutstanding, 0);
        totalLiabilities += bnpl.reduce((sum, item) => sum + item.currentOutstanding, 0);
        totalLiabilities += borrowed.reduce((sum, item) => sum + item.outstandingAmount, 0);

        return {
          totals: {
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
          },
        };
      })(),
    ]);

    const previousBalance = balanceVal - last30DaysDelta;
    const rawPercent = previousBalance !== 0 ? (last30DaysDelta / previousBalance) * 100 : 0;
    const percentChange = Math.round(rawPercent);

    const balanceObj = {
      balance: balanceVal,
      lastMonthDelta: last30DaysDelta,
      last30DaysDelta,
      percentChange,
    };

    return NextResponse.json({
      ok: true,
      data: {
        balance: balanceObj,
        networth: networthSummary,
        savings,
        burn,
        runway,
        monthly,
        categories,
        heatmap,
        seasonality,
        acceleration,
        insights,
        budgets,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
