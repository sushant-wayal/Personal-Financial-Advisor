import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { calculateAveragedMonthlyIncomeAndExpense } from "../../../src/services/analytics";

const VALID_EF_STRATEGIES = ["BALANCED", "AGGRESSIVE_EF", "ACCELERATED_GOALS", "STRICT"];

export async function GET() {
    try {
        const profile = await prisma.financialProfile.findFirst();
        const averages = await calculateAveragedMonthlyIncomeAndExpense();
        
        if (profile) {
            if (!profile.monthlyIncome || profile.monthlyIncome === 0) {
                profile.monthlyIncome = averages.monthlyIncome;
            }
            if (!profile.monthlyExpenses || profile.monthlyExpenses === 0) {
                profile.monthlyExpenses = averages.monthlyExpenses;
            }
            // Auto-migrate legacy 50/25/15/10 profile sub-allocations to 70/20/10 and 30/60/10
            if (profile.stdEquityPct === 50 || profile.consEquityPct === 20) {
                const updatedProfile = await prisma.financialProfile.update({
                    where: { id: profile.id },
                    data: {
                        stdEquityPct: 70,
                        stdDebtPct: 20,
                        stdGoldPct: 10,
                        consEquityPct: 30,
                        consDebtPct: 60,
                        consGoldPct: 10,
                    },
                });
                Object.assign(profile, updatedProfile);
            }
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
            stdEquityPct: numOr(body.stdEquityPct, 70),
            stdDebtPct: numOr(body.stdDebtPct, 20),
            stdGoldPct: numOr(body.stdGoldPct, 10),
            consEquityPct: numOr(body.consEquityPct, 30),
            consDebtPct: numOr(body.consDebtPct, 60),
            consGoldPct: numOr(body.consGoldPct, 10),
            equityNifty50Pct: numOr(body.equityNifty50Pct, 60),
            equityNiftyNext50Pct: numOr(body.equityNiftyNext50Pct, 20),
            equityMidcapPct: numOr(body.equityMidcapPct, 20),
        };

        const existing = await prisma.financialProfile.findFirst();
        const averages = await calculateAveragedMonthlyIncomeAndExpense();

        if (existing) {
            const updated = await prisma.financialProfile.update({
                where: { id: existing.id },
                data: {
                    ownerName: body.ownerName ?? existing.ownerName,
                    currency: body.currency ?? existing.currency,
                    balance: typeof body.balance === "number" ? body.balance : existing.balance,
                    monthlyIncome: typeof body.monthlyIncome === "number" ? body.monthlyIncome : existing.monthlyIncome,
                    monthlyExpenses: typeof body.monthlyExpenses === "number" ? body.monthlyExpenses : existing.monthlyExpenses,
                    emergencyFundMonths: incomingMonths !== null ? incomingMonths : existing.emergencyFundMonths,
                    efStrategy: incomingStrategy || existing.efStrategy || "BALANCED",
                    ...investmentData,
                },
            });
            if (!updated.monthlyIncome) updated.monthlyIncome = averages.monthlyIncome;
            if (!updated.monthlyExpenses) updated.monthlyExpenses = averages.monthlyExpenses;
            return NextResponse.json({ ok: true, profile: updated });
        }

        const created = await prisma.financialProfile.create({
            data: {
                ownerName: body.ownerName || null,
                currency: body.currency || "INR",
                balance: typeof body.balance === "number" ? body.balance : 0,
                monthlyIncome: typeof body.monthlyIncome === "number" ? body.monthlyIncome : averages.monthlyIncome,
                monthlyExpenses: typeof body.monthlyExpenses === "number" ? body.monthlyExpenses : averages.monthlyExpenses,
                emergencyFundMonths: incomingMonths !== null ? incomingMonths : 6,
                efStrategy: incomingStrategy || "BALANCED",
                ...investmentData,
            },
        });
        return NextResponse.json({ ok: true, profile: created });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
