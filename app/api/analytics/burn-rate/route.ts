import { NextResponse } from "next/server";
import { calculateBurnRate } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await calculateBurnRate();
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
