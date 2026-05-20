import { NextResponse } from "next/server";
import { spendingAcceleration } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await spendingAcceleration(12);
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
