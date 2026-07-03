import { NextResponse } from "next/server";
import { getEmergencyFundStatus } from "../../../src/services/emergencyFund";

export async function GET() {
    try {
        const status = await getEmergencyFundStatus();
        return NextResponse.json({ ok: true, ...status });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
