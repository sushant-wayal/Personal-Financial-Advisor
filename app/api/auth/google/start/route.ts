import { NextResponse } from "next/server";
import { buildAuthUrl } from "../../../../../src/services/gmail";

export async function GET() {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!redirectUri) {
        return NextResponse.json({ error: "redirect uri not configured" }, { status: 500 });
    }

    const url = buildAuthUrl(redirectUri);
    return NextResponse.redirect(url);
}