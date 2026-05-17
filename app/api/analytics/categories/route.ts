import { NextResponse } from "next/server";
import { categoryBreakdown } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await categoryBreakdown(30);
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
