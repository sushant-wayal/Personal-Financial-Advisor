import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function GET() {
    try {
        const profile = await prisma.financialProfile.findFirst();
        return NextResponse.json({ ok: true, profile });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const existing = await prisma.financialProfile.findFirst();
        if (existing) {
            const updated = await prisma.financialProfile.update({
                where: { id: existing.id }, data: {
                    ownerName: body.ownerName ?? existing.ownerName,
                    currency: body.currency ?? existing.currency,
                    balance: typeof body.balance === 'number' ? body.balance : existing.balance,
                    emergencyFund: typeof body.emergencyFund === 'number' ? body.emergencyFund : existing.emergencyFund,
                    monthlyIncome: typeof body.monthlyIncome === 'number' ? body.monthlyIncome : existing.monthlyIncome,
                    monthlyExpenses: typeof body.monthlyExpenses === 'number' ? body.monthlyExpenses : existing.monthlyExpenses,
                }
            });
            return NextResponse.json({ ok: true, profile: updated });
        }

        const created = await prisma.financialProfile.create({
            data: {
                ownerName: body.ownerName || null,
                currency: body.currency || "INR",
                balance: typeof body.balance === 'number' ? body.balance : 0,
                emergencyFund: typeof body.emergencyFund === 'number' ? body.emergencyFund : 0,
                monthlyIncome: typeof body.monthlyIncome === 'number' ? body.monthlyIncome : 0,
                monthlyExpenses: typeof body.monthlyExpenses === 'number' ? body.monthlyExpenses : 0,
            }
        });
        return NextResponse.json({ ok: true, profile: created });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
