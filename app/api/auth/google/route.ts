import { NextResponse } from "next/server";
import { exchangeCodeForTokens, storeTokens } from "../../../../src/services/gmail";
import { startGmailWatch } from "../../../../src/services/gmail-watch.service";

export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
    if (!redirectUri) return NextResponse.json({ error: "redirect uri not configured" }, { status: 500 });

    try {
        const tokens = await exchangeCodeForTokens(code, redirectUri);
        await storeTokens(tokens);
        try {
            await startGmailWatch();
        } catch (error) {
            console.error("[gmail-auth] watch creation failed", error);
        }
        return NextResponse.redirect(new URL("/?gmail=connected", req.url));
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
