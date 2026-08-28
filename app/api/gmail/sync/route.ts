import { NextResponse } from "next/server";
import { withGmailAuth } from "../../../../src/services/gmail";
import { syncGmailIncrementally } from "../../../../src/services/gmail-history.service";
import { handleMutualFundWebhookPush } from "../../../../src/services/mutual-fund-webhook.service";

export async function POST() {
    try {
        return await withGmailAuth(async (accessToken) => {
            const [historyRes, mfRes] = await Promise.all([
                syncGmailIncrementally({ accessToken }),
                handleMutualFundWebhookPush().catch(err => {
                    console.error("[gmail-sync] mf push error:", err);
                    return { ok: false, error: String(err) };
                })
            ]);
            return NextResponse.json({ ...historyRes, mutualFunds: mfRes });
        });
    } catch (e: any) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        console.error("[gmail-sync] auth wrapper failed", { status, data });
        return NextResponse.json({ error: "Authentication failed", details: data }, { status: status || 500 });
    }
}
