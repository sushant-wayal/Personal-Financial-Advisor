import { NextResponse } from "next/server";
import { handleMutualFundWebhookPush } from "../../../../src/services/mutual-fund-webhook.service";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await handleMutualFundWebhookPush(body);
        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error("[mf-webhook] invalid notification", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 400 });
    }
}
