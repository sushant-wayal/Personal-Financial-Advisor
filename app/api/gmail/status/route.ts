import { NextResponse } from "next/server";
import { getStoredTokens } from "../../../../src/services/gmail";

export async function GET() {
    const tokens = await getStoredTokens();
    return NextResponse.json({ connected: Boolean(tokens?.access_token) });
}