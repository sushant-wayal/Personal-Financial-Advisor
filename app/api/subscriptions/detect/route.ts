import { NextResponse } from "next/server";
import { detectSubscriptions } from "../../../../src/services/subscriptionDetector";

export async function POST() {
    try {
        const detected = await detectSubscriptions();
        return NextResponse.json({ ok: true, detected });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
