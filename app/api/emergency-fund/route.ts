import { NextResponse } from "next/server";
import { getEmergencyFundStatus } from "../../../src/services/emergencyFund";

import { prisma } from "../../../src/lib/prisma";

export const revalidate = 10;

export async function GET() {
    try {
        const [status, profile] = await Promise.all([
            getEmergencyFundStatus(),
            prisma.financialProfile.findFirst(),
        ]);
        return NextResponse.json({ ok: true, ...status, profile });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
