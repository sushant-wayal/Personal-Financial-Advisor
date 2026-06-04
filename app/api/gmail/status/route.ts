import { NextResponse } from "next/server";
import { getStoredTokens } from "../../../../src/services/gmail";
import { ensureActiveGmailWatch, getStoredGmailWatch } from "../../../../src/services/gmail-watch.service";

export async function GET() {
    const tokens = await getStoredTokens();
    let renewalError: string | null = null;
    const watch = tokens?.access_token ? await ensureActiveGmailWatch().catch(async (error: any) => {
        renewalError = error?.message || String(error);
        console.error("[gmail-status] watch renewal check failed", error);
        return getStoredGmailWatch().catch(() => null);
    }) : await getStoredGmailWatch().catch(() => null);
    const expirationMs = watch?.expiration ? new Date(watch.expiration).getTime() : NaN;
    const watchActive = Boolean(watch && Number.isFinite(expirationMs) && expirationMs > Date.now());

    return NextResponse.json({
        connected: Boolean(tokens?.access_token),
        watchActive,
        watchExpired: Boolean(watch && !watchActive),
        watchExpiration: watch?.expiration || null,
        renewalError,
    });
}
