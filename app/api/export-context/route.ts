import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { calculateCurrentBalance, calculateBurnRate, calculateMonthlySavingsRate, calculateRunway, categoryBreakdown, monthlyTrend, calculateAveragedMonthlyIncomeAndExpense } from "@/src/services/analytics";
import { listGoals, predictETA, recommendMonthlyContribution } from "@/src/services/goals";
import { getEnrichedBudgets } from "@/src/services/budgets";
import { getEmergencyFundStatus } from "@/src/services/emergencyFund";
import { getOrGenerateInvestmentSuggestion } from "@/src/services/investmentEngine";

function fmt(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

function fmtDate(date: Date | string | null | undefined) {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function fmtPct(value: number) {
    return `${Math.round(value * 100) / 100}%`;
}

function monthsUntil(targetDate?: Date | null) {
    if (!targetDate) return null;
    const now = new Date();
    return Math.max(0, (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth()));
}

function mdTable(headers: string[], rows: string[][]) {
    if (rows.length === 0) return "_No data available._\n";
    const headerLine = `| ${headers.join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataLines = rows.map(row => `| ${row.join(" | ")} |`).join("\n");
    return `${headerLine}\n${separator}\n${dataLines}\n`;
}

export async function GET() {
    try {
        const now = new Date();
        const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        // Fetch everything in parallel
        const [
            profile,
            transactions,
            goals,
            subscriptions,
            memories,
            budgets,
            // Net worth assets
            ppf, epf, fd, rd, mutualFunds, stocks,
            vehicles, plots, independentProperties, apartments, jewellery, receivables,
            // Net worth liabilities
            loans, creditCards, bnpl, borrowed,
            // Analytics
            bankBalance,
            monthly,
            categoryData,
            savings,
            burn,
            runway,
            averages,
            efStatus,
            investmentData,
            investmentHistory,
        ] = await Promise.all([
            prisma.financialProfile.findFirst(),
            prisma.transaction.findMany({
                where: { timestamp: { gte: days90Ago } },
                orderBy: { timestamp: "desc" },
                include: { category: true },
            }),
            listGoals(),
            prisma.subscription.findMany({ orderBy: { updatedAt: "desc" } }),
            prisma.aIMemory.findMany({ orderBy: { updatedAt: "desc" } }),
            getEnrichedBudgets(),
            // Assets
            prisma.pPFAccount.findMany(),
            prisma.ePFAccount.findMany(),
            prisma.fDAccount.findMany(),
            prisma.rDAccount.findMany(),
            prisma.mutualFund.findMany(),
            prisma.stock.findMany(),
            prisma.vehicleAsset.findMany(),
            prisma.plotAsset.findMany(),
            prisma.independentPropertyAsset.findMany(),
            prisma.apartmentAsset.findMany(),
            prisma.jewelleryAsset.findMany(),
            prisma.receivableAsset.findMany(),
            // Liabilities
            prisma.loanLiability.findMany(),
            prisma.creditCardLiability.findMany(),
            prisma.bnplLiability.findMany(),
            prisma.borrowedLiability.findMany(),
            // Analytics
            calculateCurrentBalance(),
            monthlyTrend(6),
            categoryBreakdown(30),
            calculateMonthlySavingsRate(),
            calculateBurnRate(),
            calculateRunway(),
            calculateAveragedMonthlyIncomeAndExpense(),
            getEmergencyFundStatus().catch(() => null),
            getOrGenerateInvestmentSuggestion().catch(() => null),
            prisma.investmentHistory.findMany({ orderBy: { investedAt: "desc" } }),
        ]);

        if (profile && averages) {
            profile.monthlyIncome = averages.monthlyIncome;
            profile.monthlyExpenses = averages.monthlyExpenses;
        }

        const currency = profile?.currency || "INR";
        const ownerName = profile?.ownerName || "User";
        const monthlySurplus = (profile?.monthlyIncome ?? 0) - (profile?.monthlyExpenses ?? 0);

        // ────────────────────────────────────────────
        //  Build the Markdown document
        // ────────────────────────────────────────────

        const sections: string[] = [];

        // Header
        sections.push(`# Personal Financial Context — ${ownerName}`);
        sections.push(`> Generated on ${now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} at ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`);
        sections.push(`> Currency: ${currency}`);
        sections.push("");
        sections.push("---");

        // ── Financial Profile ──
        sections.push("\n## 📋 Financial Profile\n");
        sections.push(`- **Name:** ${ownerName}`);
        sections.push(`- **Currency:** ${currency}`);
        sections.push(`- **Bank Balance:** ${fmt(profile?.balance ?? 0, currency)}`);
        sections.push(`- **Monthly Income:** ${fmt(profile?.monthlyIncome ?? 0, currency)} _(90-day rolling average)_`);
        sections.push(`- **Monthly Expenses:** ${fmt(profile?.monthlyExpenses ?? 0, currency)} _(90-day rolling average)_`);
        sections.push(`- **Monthly Surplus:** ${fmt(monthlySurplus, currency)}`);
        sections.push(`- **Emergency Fund Coverage Target:** ${profile?.emergencyFundMonths ?? 6} months`);
        sections.push(`- **EF Strategy:** ${profile?.efStrategy ?? "BALANCED"}`);

        // ── Net Worth ──
        sections.push("\n---\n\n## 💰 Net Worth Breakdown\n");

        // Calculate asset totals
        let totalAssets = bankBalance;
        totalAssets += ppf.reduce((s, i) => s + (i.currentWorth ?? i.currentBalance), 0);
        totalAssets += epf.reduce((s, i) => s + (i.currentWorth ?? i.currentBalance), 0);
        totalAssets += fd.reduce((s, i) => s + (i.currentWorth ?? i.principalAmount), 0);
        totalAssets += rd.reduce((s, i) => s + (i.currentWorth ?? i.currentTotalDeposits), 0);
        totalAssets += mutualFunds.reduce((s, i) => s + (i.currentWorth ?? (i.currentUnits * (i.currentNav ?? 0))), 0);
        totalAssets += stocks.reduce((s, i) => s + (i.currentWorth ?? (i.currentQuantity * (i.currentPrice ?? 0))), 0);
        totalAssets += vehicles.reduce((s, i) => s + (i.currentWorth ?? (i.purchasePrice ?? 0)), 0);
        totalAssets += plots.reduce((s, i) => s + (i.currentWorth ?? (i.purchasePrice ?? 0)), 0);
        totalAssets += independentProperties.reduce((s, i) => s + (i.currentWorth ?? (i.purchasePrice ?? 0)), 0);
        totalAssets += apartments.reduce((s, i) => s + (i.currentWorth ?? (i.purchasePrice ?? 0)), 0);
        totalAssets += jewellery.reduce((s, i) => s + (i.currentWorth ?? (i.purchasePrice ?? 0)), 0);
        totalAssets += receivables.reduce((s, i) => s + (i.currentWorth ?? i.principalAmount), 0);

        let totalLiabilities = 0;
        totalLiabilities += loans.reduce((s, i) => s + i.outstandingBalance, 0);
        totalLiabilities += creditCards.reduce((s, i) => s + i.currentOutstanding, 0);
        totalLiabilities += bnpl.reduce((s, i) => s + i.currentOutstanding, 0);
        totalLiabilities += borrowed.reduce((s, i) => s + i.outstandingAmount, 0);

        const netWorth = totalAssets - totalLiabilities;

        sections.push(`- **Total Assets:** ${fmt(totalAssets, currency)}`);
        sections.push(`- **Total Liabilities:** ${fmt(totalLiabilities, currency)}`);
        sections.push(`- **Net Worth:** ${fmt(netWorth, currency)}`);

        // Assets breakdown
        sections.push("\n### Assets\n");

        sections.push(`**Liquid Cash:** ${fmt(bankBalance, currency)}\n`);

        if (ppf.length > 0) {
            sections.push("**PPF Accounts:**\n");
            sections.push(mdTable(
                ["Balance", "Interest Rate", "Current Worth"],
                ppf.map(a => [fmt(a.currentBalance, currency), `${a.currentInterestRate}%`, fmt(a.currentWorth ?? a.currentBalance, currency)])
            ));
        }

        if (epf.length > 0) {
            sections.push("**EPF Accounts:**\n");
            sections.push(mdTable(
                ["Balance", "Employee Contrib/mo", "Employer Contrib/mo", "Interest Rate", "Current Worth"],
                epf.map(a => [fmt(a.currentBalance, currency), fmt(a.monthlyEmployeeContribution, currency), fmt(a.monthlyEmployerContribution, currency), `${a.currentInterestRate}%`, fmt(a.currentWorth ?? a.currentBalance, currency)])
            ));
        }

        if (fd.length > 0) {
            sections.push("**Fixed Deposits:**\n");
            sections.push(mdTable(
                ["Bank", "Principal", "Interest Rate", "Payout", "Maturity", "Current Worth"],
                fd.map(a => [a.bankName, fmt(a.principalAmount, currency), `${a.annualInterestRate}%`, a.payoutType, fmtDate(a.maturityDate), fmt(a.currentWorth, currency)])
            ));
        }

        if (rd.length > 0) {
            sections.push("**Recurring Deposits:**\n");
            sections.push(mdTable(
                ["Bank", "Monthly Deposit", "Interest Rate", "Total Deposits", "Current Worth"],
                rd.map(a => [a.bankName, fmt(a.monthlyDepositAmount, currency), `${a.annualInterestRate}%`, fmt(a.currentTotalDeposits, currency), fmt(a.currentWorth, currency)])
            ));
        }

        if (mutualFunds.length > 0) {
            sections.push("**Mutual Funds:**\n");
            sections.push(mdTable(
                ["Scheme", "Plan", "Units", "NAV", "Current Worth"],
                mutualFunds.map(a => [a.schemeName, `${a.planType} / ${a.option}`, a.currentUnits.toFixed(3), fmt(a.currentNav ?? 0, currency), fmt(a.currentWorth ?? (a.currentUnits * (a.currentNav ?? 0)), currency)])
            ));
        }

        if (stocks.length > 0) {
            sections.push("**Stocks:**\n");
            sections.push(mdTable(
                ["Symbol", "Exchange", "Qty", "Price", "Current Worth"],
                stocks.map(a => [a.symbol, a.exchange, String(a.currentQuantity), fmt(a.currentPrice ?? 0, currency), fmt(a.currentWorth ?? (a.currentQuantity * (a.currentPrice ?? 0)), currency)])
            ));
        }

        if (vehicles.length > 0) {
            sections.push("**Vehicles:**\n");
            sections.push(mdTable(
                ["Type", "Brand", "Model", "Year", "Purchase Price", "Current Worth"],
                vehicles.map(a => [a.type, a.brand, a.modelName, String(a.manufacturingYear), fmt(a.purchasePrice ?? 0, currency), fmt(a.currentWorth ?? 0, currency)])
            ));
        }

        if (plots.length > 0) {
            sections.push("**Plots:**\n");
            sections.push(mdTable(
                ["Location", "Area", "Purchase Price", "Current Worth"],
                plots.map(a => [`${a.locality}, ${a.city}, ${a.state}`, `${a.area} ${a.areaUnit}`, fmt(a.purchasePrice ?? 0, currency), fmt(a.currentWorth ?? 0, currency)])
            ));
        }

        if (independentProperties.length > 0) {
            sections.push("**Independent Properties:**\n");
            sections.push(mdTable(
                ["Location", "Land Area", "Built-up Area", "Purchase Price", "Current Worth"],
                independentProperties.map(a => [`${a.locality}, ${a.city}, ${a.state}`, `${a.landArea} ${a.landAreaUnit}`, `${a.builtUpArea} sqft`, fmt(a.purchasePrice ?? 0, currency), fmt(a.currentWorth ?? 0, currency)])
            ));
        }

        if (apartments.length > 0) {
            sections.push("**Apartments:**\n");
            sections.push(mdTable(
                ["Location", "BHK", "Built-up Area", "Builder/Project", "Purchase Price", "Current Worth"],
                apartments.map(a => [`${a.locality}, ${a.city}, ${a.state}`, a.bhk ?? "—", `${a.builtUpArea} sqft`, `${a.builder ?? "—"} / ${a.projectName ?? "—"}`, fmt(a.purchasePrice ?? 0, currency), fmt(a.currentWorth ?? 0, currency)])
            ));
        }

        if (jewellery.length > 0) {
            sections.push("**Jewellery:**\n");
            sections.push(mdTable(
                ["Metal", "Purity", "Weight", "Purchase Price", "Current Worth"],
                jewellery.map(a => [a.metalType, String(a.purity), `${a.netWeight} ${a.weightUnit}`, fmt(a.purchasePrice ?? 0, currency), fmt(a.currentWorth ?? 0, currency)])
            ));
        }

        if (receivables.length > 0) {
            sections.push("**Receivables (Money Owed to Me):**\n");
            sections.push(mdTable(
                ["Name", "Category", "Principal", "Interest", "Expected Return", "Current Worth"],
                receivables.map(a => [a.name, a.category, fmt(a.principalAmount, currency), a.interestType !== "NONE" ? `${a.interestRate}% ${a.interestType}` : "None", fmtDate(a.expectedReturnDate), fmt(a.currentWorth ?? a.principalAmount, currency)])
            ));
        }

        // Liabilities breakdown
        sections.push("\n### Liabilities\n");

        if (loans.length > 0) {
            sections.push("**Loans:**\n");
            sections.push(mdTable(
                ["Type", "Outstanding", "Interest Rate", "EMI", "EMI Date", "Remaining EMIs"],
                loans.map(a => [a.loanType, fmt(a.outstandingBalance, currency), `${a.interestRate}% ${a.interestType}`, fmt(a.emiAmount, currency), `Day ${a.emiDebitDate}`, a.remainingEmiCount != null ? String(a.remainingEmiCount) : "—"])
            ));
        }

        if (creditCards.length > 0) {
            sections.push("**Credit Cards:**\n");
            sections.push(mdTable(
                ["Outstanding", "Interest Rate", "Statement Day", "Due Day", "Annual Fee", "Min Payment %"],
                creditCards.map(a => [fmt(a.currentOutstanding, currency), `${a.annualInterestRate}%`, `Day ${a.statementGenerationDay}`, `Day ${a.paymentDueDay}`, fmt(a.annualFee, currency), `${a.minimumPaymentPercentage}%`])
            ));
        }

        if (bnpl.length > 0) {
            sections.push("**Buy Now Pay Later:**\n");
            sections.push(mdTable(
                ["Provider", "Outstanding", "Monthly Installment", "Due Day", "Remaining"],
                bnpl.filter(a => !a.isClosed).map(a => [a.provider, fmt(a.currentOutstanding, currency), fmt(a.monthlyInstallment, currency), `Day ${a.paymentDueDay}`, a.remainingInstallments != null ? String(a.remainingInstallments) : "—"])
            ));
        }

        if (borrowed.length > 0) {
            sections.push("**Borrowed (Informal Debts):**\n");
            sections.push(mdTable(
                ["Lender", "Outstanding", "Interest Rate", "Installment", "Next Repayment"],
                borrowed.filter(a => !a.isClosed).map(a => [a.lenderName, fmt(a.outstandingAmount, currency), `${a.interestRate}%`, a.installmentAmount ? fmt(a.installmentAmount, currency) : "—", fmtDate(a.nextRepaymentDate)])
            ));
        }

        if (loans.length === 0 && creditCards.length === 0 && bnpl.filter(a => !a.isClosed).length === 0 && borrowed.filter(a => !a.isClosed).length === 0) {
            sections.push("_No liabilities recorded._\n");
        }

        // ── Transactions ──
        sections.push("\n---\n\n## 📊 Transactions (Last 90 Days)\n");
        sections.push(`Total transactions: ${transactions.length}\n`);

        if (transactions.length > 0) {
            // Show a summary table, cap at 200 rows to keep file manageable
            const txRows = transactions.slice(0, 200).map((tx: any) => [
                fmtDate(tx.timestamp),
                (tx.merchant || "Unknown").replace(/\|/g, "/"),
                (tx.category?.name || "—").replace(/\|/g, "/"),
                fmt(Math.abs(tx.amount || 0), currency),
                tx.type || tx.transactionType || "—",
            ]);
            sections.push(mdTable(["Date", "Merchant", "Category", "Amount", "Type"], txRows));
            if (transactions.length > 200) {
                sections.push(`_...and ${transactions.length - 200} more transactions not shown._\n`);
            }
        }

        // ── Spending Analytics ──
        sections.push("\n---\n\n## 📈 Spending Analytics\n");

        const savingsRate = (savings && typeof savings === "object" && "savingsRate" in (savings as any))
            ? Number((savings as any).savingsRate ?? 0)
            : Number(savings ?? 0);
        const burnRate = (burn && typeof burn === "object" && "burnRate" in (burn as any))
            ? Number((burn as any).burnRate ?? 0)
            : Number(burn ?? 0);
        const runwayMonths = (runway && typeof runway === "object" && "runwayMonths" in (runway as any))
            ? Number((runway as any).runwayMonths ?? 0)
            : Number(runway ?? 0);

        sections.push(`- **Savings Rate:** ${fmtPct(savingsRate)}`);
        sections.push(`- **Burn Rate:** ${fmt(burnRate, currency)}/month`);
        sections.push(`- **Financial Runway:** ${runwayMonths.toFixed(1)} months`);

        if (monthly && Array.isArray(monthly) && monthly.length > 0) {
            sections.push("\n### Monthly Trend (Last 6 Months)\n");
            sections.push(mdTable(
                ["Month", "Income", "Expenses", "Net"],
                (monthly as any[]).map(m => [
                    m.month || m.label || "—",
                    fmt(m.income ?? 0, currency),
                    fmt(Math.abs(m.expenses ?? m.expense ?? 0), currency),
                    fmt((m.income ?? 0) - Math.abs(m.expenses ?? m.expense ?? 0), currency),
                ])
            ));
        }

        if (categoryData && Array.isArray(categoryData) && categoryData.length > 0) {
            sections.push("\n### Category Breakdown (Last 30 Days)\n");
            const totalSpend = (categoryData as any[]).reduce((s: number, x: any) => s + Math.abs(x.value ?? x.amount ?? x.total ?? 0), 0);
            sections.push(mdTable(
                ["Category", "Amount", "% of Total"],
                (categoryData as any[]).map(c => {
                    const amt = Math.abs(c.value ?? c.amount ?? c.total ?? 0);
                    const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : "0.0";
                    return [c.name || c.category || "Unknown", fmt(amt, currency), `${pct}%`];
                })
            ));
        }

        // ── Goals ──
        sections.push("\n---\n\n## 🎯 Financial Goals\n");
        if ((goals as any[]).length === 0) {
            sections.push("_No goals configured._\n");
        } else {
            for (const goal of goals as any[]) {
                const targetAmt = Number(goal.targetAmount || 0);
                const currentAmt = Number(goal.currentAmount || 0);
                const progress = targetAmt > 0 ? Math.min(100, (currentAmt / targetAmt) * 100) : 0;
                const monthsLeft = monthsUntil(goal.targetDate ? new Date(goal.targetDate) : null) ?? 12;
                const monthlyContrib = goal.monthlyTarget && goal.monthlyTarget > 0
                    ? Number(goal.monthlyTarget)
                    : recommendMonthlyContribution(currentAmt, targetAmt, Math.max(1, monthsLeft));
                const eta = monthlyContrib > 0 ? predictETA(currentAmt, monthlyContrib, targetAmt) : null;

                sections.push(`### ${goal.title} (Priority: ${goal.priority ?? "—"})`);
                sections.push(`- **Target Amount:** ${fmt(targetAmt, goal.currency || currency)}`);
                sections.push(`- **Current Saved:** ${fmt(currentAmt, goal.currency || currency)} (${progress.toFixed(1)}%)`);
                sections.push(`- **Remaining Shortfall:** ${fmt(Math.max(0, targetAmt - currentAmt), goal.currency || currency)}`);
                sections.push(`- **Recommended Monthly Contribution:** ${fmt(monthlyContrib, goal.currency || currency)}`);
                if (goal.targetDate) sections.push(`- **Target Date:** ${fmtDate(goal.targetDate)}`);
                if (eta) {
                    sections.push(`- **Months to Target Completion (ETA):** ${eta.months} months`);
                    sections.push(`- **Estimated Completion Date (ETA):** ${fmtDate(eta.eta)}`);
                }
                if (goal.notes) sections.push(`- **Notes:** ${goal.notes}`);
                sections.push("");
            }
        }

        // ── Subscriptions ──
        sections.push("\n---\n\n## 🔁 Subscriptions\n");
        const activeSubs = subscriptions.filter((s: any) => s.active !== false);
        const recurringMonthly = activeSubs.reduce((s: number, sub: any) => s + Math.abs(Number(sub.amount || 0)), 0);
        sections.push(`Active subscriptions: ${activeSubs.length} | Monthly recurring: ${fmt(recurringMonthly, currency)}\n`);

        if (activeSubs.length > 0) {
            sections.push(mdTable(
                ["Merchant", "Amount", "Interval", "Next Charge"],
                activeSubs.map((s: any) => [s.merchant, fmt(s.amount, currency), s.interval, fmtDate(s.nextCharge)])
            ));
        }

        // ── Budgets ──
        sections.push("\n---\n\n## 📦 Budgets\n");
        if (budgets.length === 0) {
            sections.push("_No budgets configured._\n");
        } else {
            sections.push(mdTable(
                ["Category", "Monthly Limit", "Spent", "Available", "Rollover"],
                budgets.map((b: any) => [
                    b.category?.name ?? "—",
                    fmt(b.monthlyLimit, currency),
                    fmt(b.spent, currency),
                    fmt(b.available, currency),
                    b.rollover ? "Yes" : "No",
                ])
            ));
        }

        // ── Monthly Investment Strategy ──
        sections.push("\n---\n\n## 📈 Monthly Investment Strategy & History\n");
        const suggestion = investmentData?.suggestion;
        if (suggestion) {
            sections.push(`- **Current Financial Phase:** ${suggestion.phaseLabel} (${suggestion.phase})`);
            sections.push(`- **Pay Cycle Length:** ${suggestion.cycleDays} days`);
            sections.push(`- **Raw Surplus (Current Cycle):** ${fmt(suggestion.rawSurplus, currency)}`);
            sections.push(`- **Smoothed Surplus:** ${fmt(suggestion.smoothedSurplus, currency)}`);
            sections.push(`- **Investable Rate (% of Surplus):** ${suggestion.investableRate}%`);
            sections.push(`- **Total Investable Capital:** ${fmt(suggestion.totalInvestable, currency)}`);
            sections.push(`- **Cycle Streak:** 🔥 ${suggestion.streak} cycles`);
            sections.push(`- **Status:** ${suggestion.status === "INVESTED" ? "Invested ✅" : "Active / Recommended"}\n`);

            sections.push("**Active Asset Sub-Allocation Breakdown:**");
            const buckets = suggestion.buckets;
            if (buckets) {
                sections.push(mdTable(
                    ["Asset Class", "Target %", "Suggested Amount", "Custom Amount"],
                    [
                        ["Equity", `${buckets.equity.pct}%`, fmt(buckets.equity.suggested, currency), fmt(buckets.equity.final, currency)],
                        ["Debt", `${buckets.debt.pct}%`, fmt(buckets.debt.suggested, currency), fmt(buckets.debt.final, currency)],
                        ["Gold", `${buckets.gold.pct}%`, fmt(buckets.gold.suggested, currency), fmt(buckets.gold.final, currency)],
                        ["Cash", `${buckets.cash.pct}%`, fmt(buckets.cash.suggested, currency), fmt(buckets.cash.final, currency)],
                    ]
                ));
            }
        } else {
            sections.push("_No active investment suggestion available._\n");
        }

        if (investmentHistory && investmentHistory.length > 0) {
            const totalHistoryInvested = investmentHistory.reduce((sum: number, h: any) => sum + Number(h.totalInvested || 0), 0);
            sections.push(`\n**Recorded Investment History (${investmentHistory.length} cycles, Total: ${fmt(totalHistoryInvested, currency)}):**\n`);
            sections.push(mdTable(
                ["Date", "Phase", "Total Invested", "Equity", "Debt", "Gold", "Cash"],
                investmentHistory.map((h: any) => [
                    fmtDate(h.investedAt),
                    h.phase,
                    fmt(h.totalInvested, currency),
                    fmt(h.equity, currency),
                    fmt(h.debt, currency),
                    fmt(h.gold, currency),
                    fmt(h.cash, currency),
                ])
            ));
        }

        // ── Emergency Fund ──
        sections.push("\n---\n\n## 🛡️ Emergency Fund\n");
        if (efStatus) {
            sections.push(`- **Strategy:** ${efStatus.efStrategy}`);
            sections.push(`- **Coverage Target:** ${efStatus.targetMonths} months`);
            sections.push(`- **Target Amount:** ${fmt(efStatus.targetAmount, currency)}`);
            sections.push(`- **Currently Reserved Cash:** ${fmt(efStatus.savedAmount, currency)}`);
            sections.push(`- **Remaining Shortfall:** ${fmt(efStatus.shortfall, currency)}`);
            sections.push(`- **Progress:** ${efStatus.progressPct.toFixed(1)}% (Tier ${efStatus.tier})`);
            sections.push(`- **Monthly EF Drip Contribution:** ${fmt(efStatus.efMonthlyDrip, currency)}`);
            sections.push(`- **Monthly Goals Pool Drip:** ${fmt(efStatus.availableGoalCapacity, currency)}`);
            sections.push(`- **Months to Target Completion (ETA):** ${efStatus.monthsToComplete != null ? `${efStatus.monthsToComplete} months` : "Fully Funded 🎉"}`);
            sections.push(`- **Estimated Target Completion Date (ETA):** ${efStatus.estimatedCompletionDate ? fmtDate(efStatus.estimatedCompletionDate) : "Fully Funded 🎉"}`);
            sections.push(`- **Fully Funded Status:** ${efStatus.isComplete ? "Yes ✅" : "No"}`);
        } else {
            sections.push("_Emergency fund status unavailable._\n");
        }

        // ── AI Memories ──
        sections.push("\n---\n\n## 🧠 AI Memories & Preferences\n");
        const safeMemories = memories.filter((mem: any) => {
            const keyLower = String(mem.key || "").toLowerCase();
            return !keyLower.includes("gmail_oauth") && !keyLower.includes("oauth") && !keyLower.includes("token");
        });

        if (safeMemories.length === 0) {
            sections.push("_No AI memories stored._\n");
        } else {
            for (const mem of safeMemories) {
                sections.push(`- **${mem.key}:** ${mem.value}`);
            }
        }

        // ── Financial Health ──
        sections.push("\n---\n\n## 🏥 Financial Health Summary\n");
        let healthStatus = "Needs Attention";
        const efCoverage = profile?.emergencyFundMonths ?? 6;
        if (runwayMonths >= 12 && efCoverage >= 6 && savingsRate >= 20 && monthlySurplus > 0) healthStatus = "Excellent";
        else if (runwayMonths >= 6 && efCoverage >= 3 && savingsRate >= 10) healthStatus = "Healthy";
        else if (runwayMonths >= 3) healthStatus = "Needs Attention";
        else healthStatus = "Critical";

        sections.push(`- **Overall Status:** ${healthStatus}`);
        sections.push(`- **Runway:** ${runwayMonths.toFixed(1)} months`);
        sections.push(`- **Savings Rate:** ${fmtPct(savingsRate)}`);
        sections.push(`- **Monthly Surplus:** ${fmt(monthlySurplus, currency)}`);
        sections.push(`- **Net Worth:** ${fmt(netWorth, currency)}`);

        const content = sections.join("\n");
        const filename = `financial-context-${now.toISOString().slice(0, 10)}.md`;

        return NextResponse.json({ ok: true, content, filename });
    } catch (e: any) {
        console.error("Export context error:", e);
        return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
}
