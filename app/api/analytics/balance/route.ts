import { NextResponse } from "next/server";
import { calculateCurrentBalance } from "../../../../src/services/analytics";
import { getLast30DaysNetImpact } from "../../../../src/services/balance";

export async function GET() {
    try {
        const balance = await calculateCurrentBalance();
        const last30DaysDelta = await getLast30DaysNetImpact();
        const previousBalance = balance - last30DaysDelta;
        const rawPercent = previousBalance !== 0
            ? (last30DaysDelta / previousBalance) * 100
            : 0;
        const percentChange = Math.round(rawPercent);

        return NextResponse.json({
            ok: true,
            data: {
                balance,
                lastMonthDelta: last30DaysDelta,
                last30DaysDelta,
                percentChange,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
