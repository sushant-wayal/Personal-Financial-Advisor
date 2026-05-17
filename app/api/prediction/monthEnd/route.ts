import { NextResponse } from "next/server";
import { predictMonthEndBalance } from "../../../../src/services/prediction";

export async function GET() {
    try {
        const result = await predictMonthEndBalance();
        return NextResponse.json({ ok: true, result });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
