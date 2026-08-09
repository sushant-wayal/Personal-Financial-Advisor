import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { calculateAveragedMonthlyIncomeAndExpense } from "../../../src/services/analytics";

const VALID_EF_STRATEGIES = ["BALANCED", "AGGRESSIVE_EF", "ACCELERATED_GOALS", "STRICT"];

export async function GET() {
    try {
        const profile = await prisma.financialProfile.findFirst();
        const averages = await calculateAveragedMonthlyIncomeAndExpense();
        
        if (profile) {
            profile.monthlyIncome = averages.monthlyIncome;
            profile.monthlyExpenses = averages.monthlyExpenses;
        }
        
        return NextResponse.json({
            ok: true,
            profile: profile || {
                ...averages,
                balance: 0,
                emergencyFundMonths: 6,
                efStrategy: "BALANCED",
                currency: "INR"
            }
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();

        // Validate emergencyFundMonths: must be >= 3 if provided
        const incomingMonths = body.emergencyFundMonths != null ? Number(body.emergencyFundMonths) : null;
        if (incomingMonths !== null && (!Number.isInteger(incomingMonths) || incomingMonths < 3)) {
            return NextResponse.json({ error: "emergencyFundMonths must be an integer >= 3" }, { status: 400 });
        }

        // Validate efStrategy if provided
        const incomingStrategy = typeof body.efStrategy === "string" ? body.efStrategy.toUpperCase() : null;
        if (incomingStrategy && !VALID_EF_STRATEGIES.includes(incomingStrategy)) {
            return NextResponse.json({ error: `efStrategy must be one of: ${VALID_EF_STRATEGIES.join(", ")}` }, { status: 400 });
        }

        const numOr = (val: any, fallback: number) => (val != null && !isNaN(Number(val)) ? Number(val) : fallback);
        const boolOr = (val: any, fallback: boolean) => (typeof val === "boolean" ? val : fallback);

        const investmentData = {
            salaryCycleDays: Math.max(30, Math.min(33, numOr(body.salaryCycleDays, 33))),
            autoSalaryCycle: boolOr(body.autoSalaryCycle, true),
            crisisInvestableRate: numOr(body.crisisInvestableRate, 0),
            efBuildingInvestableRate: numOr(body.efBuildingInvestableRate, 15),
            wealthBuildingInvestableRate: numOr(body.wealthBuildingInvestableRate, 100),
            goalSprintInvestableRate: numOr(body.goalSprintInvestableRate, 40),
            stdEquityPct: numOr(body.stdEquityPct, 50),
            stdDebtPct: numOr(body.stdDebtPct, 25),
            stdGoldPct: numOr(body.stdGoldPct, 15),
            stdCashPct: numOr(body.stdCashPct, 10),
            consEquityPct: numOr(body.consEquityPct, 20),
            consDebtPct: numOr(body.consDebtPct, 50),
            consGoldPct: numOr(body.consGoldPct, 10),
            consCashPct: numOr(body.consCashPct, 20),
        };

        const existing = await prisma.financialProfile.findFirst();
        if (existing) {
            const updated = await prisma.financialProfile.update({
                where: { id: existing.id },
                data: {
                    ownerName: body.ownerName ?? existing.ownerName,
                    currency: body.currency ?? existing.currency,
                    balance: typeof body.balance === "number" ? body.balance : existing.balance,
                    emergencyFundMonths: incomingMonths !== null ? incomingMonths : existing.emergencyFundMonths,
                    efStrategy: incomingStrategy || existing.efStrategy || "BALANCED",
                    ...investmentData,
                },
            });
            const averages = await calculateAveragedMonthlyIncomeAndExpense();
            updated.monthlyIncome = averages.monthlyIncome;
            updated.monthlyExpenses = averages.monthlyExpenses;
            return NextResponse.json({ ok: true, profile: updated });
        }

        const created = await prisma.financialProfile.create({
            data: {
                ownerName: body.ownerName || null,
                currency: body.currency || "INR",
                balance: typeof body.balance === "number" ? body.balance : 0,
                emergencyFundMonths: incomingMonths !== null ? incomingMonths : 6,
                efStrategy: incomingStrategy || "BALANCED",
                ...investmentData,
            },
        });
        const averages = await calculateAveragedMonthlyIncomeAndExpense();
        created.monthlyIncome = averages.monthlyIncome;
        created.monthlyExpenses = averages.monthlyExpenses;
        return NextResponse.json({ ok: true, profile: created });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
