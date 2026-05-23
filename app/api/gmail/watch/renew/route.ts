import { NextResponse } from "next/server";
import { renewExpiringGmailWatches, startGmailWatch } from "../../../../../src/services/gmail-watch.service";

export async function POST() {
    try {
        const renewed = await renewExpiringGmailWatches();
        return NextResponse.json({ ok: true, renewed });
    } catch (error: any) {
        console.error("[gmail-watch] renewal failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}

export async function GET() {
    try {
        const started = await startGmailWatch();
        return NextResponse.json({ ok: true, started });
    } catch (error: any) {
        console.error("[gmail-watch] start failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}
