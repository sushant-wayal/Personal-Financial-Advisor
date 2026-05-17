import { NextResponse } from "next/server";
import { exchangeCodeForTokens, storeTokens } from "../../../../src/services/gmail";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
    if (!redirectUri) return NextResponse.json({ error: "redirect uri not configured" }, { status: 500 });

    try {
        const tokens = await exchangeCodeForTokens(code, redirectUri);
        await storeTokens(tokens);
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
