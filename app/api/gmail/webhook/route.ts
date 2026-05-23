import { NextResponse } from "next/server";
import { handleGmailWebhookPush } from "../../../../../src/services/gmail-webhook.service";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await handleGmailWebhookPush(body);
        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error("[gmail-webhook] invalid notification", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 400 });
    }
}
