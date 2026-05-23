import { NextResponse } from "next/server";
import { withGmailAuth } from "../../../../src/services/gmail";
import { syncGmailIncrementally } from "../../../../src/services/gmail-history.service";

export async function POST() {
    try {
        return await withGmailAuth(async (accessToken) => {
            const result = await syncGmailIncrementally({ accessToken });
            return NextResponse.json(result);
        });
    } catch (e: any) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        console.error("[gmail-sync] auth wrapper failed", { status, data });
        return NextResponse.json({ error: "Authentication failed", details: data }, { status: status || 500 });
    }
}
