import { NextResponse } from "next/server";
import { getEmergencyFundStatus } from "../../../src/services/emergencyFund";

import { prisma } from "../../../src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const profile = await prisma.financialProfile.findFirst();
        const status = await getEmergencyFundStatus({ profile });
        return NextResponse.json({ ok: true, ...status, profile });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
