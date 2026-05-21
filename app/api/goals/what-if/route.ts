import { NextResponse } from "next/server";
import { simulateWhatIf, simulateSpendingReduction, simulateLargeExpense } from "../../../../src/services/WhatIfService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { scenario, amount, categoryName, expenseName } = body;

        let result;
        if (scenario === "capacity-delta") {
            result = await simulateWhatIf(amount);
        } else if (scenario === "spending-reduction") {
            result = await simulateSpendingReduction(categoryName, amount);
        } else if (scenario === "large-expense") {
            result = await simulateLargeExpense(expenseName, amount);
        } else {
            return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
        }

        return NextResponse.json({ ok: true, scenario: result });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
