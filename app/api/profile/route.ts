import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import { calculateAveragedMonthlyIncomeAndExpense } from "../../../src/services/analytics";

export async function GET() {
    try {
        const profile = await prisma.financialProfile.findFirst();
        const averages = await calculateAveragedMonthlyIncomeAndExpense();
        
        if (profile) {
            profile.monthlyIncome = averages.monthlyIncome;
            profile.monthlyExpenses = averages.monthlyExpenses;
        }
        
        return NextResponse.json({ ok: true, profile: profile || { ...averages, balance: 0, emergencyFundMonths: 6, currency: "INR" } });
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

        const existing = await prisma.financialProfile.findFirst();
        if (existing) {
            const updated = await prisma.financialProfile.update({
                where: { id: existing.id },
                data: {
                    ownerName: body.ownerName ?? existing.ownerName,
                    currency: body.currency ?? existing.currency,
                    balance: typeof body.balance === "number" ? body.balance : existing.balance,
                    emergencyFundMonths: incomingMonths !== null ? incomingMonths : existing.emergencyFundMonths,
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

