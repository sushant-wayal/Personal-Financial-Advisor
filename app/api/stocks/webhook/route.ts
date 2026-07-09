import { NextResponse } from "next/server";
import { handleStockWebhookPush } from "@/src/services/stock-webhook.service";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = await handleStockWebhookPush(body);
        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        console.error("[stock-webhook] invalid notification", error);
        return NextResponse.json({ error: error?.message || String(error) }, { status: 400 });
    }
}
