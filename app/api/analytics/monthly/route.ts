import { NextResponse } from "next/server";
import { monthlyTrend } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await monthlyTrend(12);
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
