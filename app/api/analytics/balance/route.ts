import { NextResponse } from "next/server";
import { calculateCurrentBalance } from "../../../../src/services/analytics";
import { getCurrentMonthNetImpact } from "../../../../src/services/balance";

export async function GET() {
    try {
        const balance = await calculateCurrentBalance();
        const lastMonthDelta = await getCurrentMonthNetImpact();
        const previousBalance = balance - lastMonthDelta;
        const percentChange = previousBalance !== 0
            ? (lastMonthDelta / previousBalance) * 100
            : 0;

        return NextResponse.json({
            ok: true,
            data: {
                balance,
                lastMonthDelta,
                percentChange,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
