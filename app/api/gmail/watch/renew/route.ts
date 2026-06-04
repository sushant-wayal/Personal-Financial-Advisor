import { NextResponse } from "next/server";
import { ensureActiveGmailWatch } from "../../../../../src/services/gmail-watch.service";

export async function POST() {
    try {
        const renewed = await ensureActiveGmailWatch();
        return NextResponse.json({ ok: true, renewed });
    } catch (error: any) {
        console.error("[gmail-watch] renewal failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}

export async function GET() {
    try {
        const renewed = await ensureActiveGmailWatch();
        return NextResponse.json({ ok: true, renewed });
    } catch (error: any) {
        console.error("[gmail-watch] renewal failed", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
    }
}
