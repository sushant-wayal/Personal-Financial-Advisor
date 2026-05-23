import { NextResponse } from "next/server";
import { getStoredTokens } from "../../../../src/services/gmail";
import { getStoredGmailWatch } from "../../../../src/services/gmail-watch.service";

export async function GET() {
    const tokens = await getStoredTokens();
    const watch = await getStoredGmailWatch().catch(() => null);
    return NextResponse.json({
        connected: Boolean(tokens?.access_token),
        watchActive: Boolean(watch),
        watchExpiration: watch?.expiration || null,
    });
}