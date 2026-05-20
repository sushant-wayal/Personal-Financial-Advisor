import { NextResponse } from "next/server";
import { seasonalPatterns } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await seasonalPatterns(365);
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
