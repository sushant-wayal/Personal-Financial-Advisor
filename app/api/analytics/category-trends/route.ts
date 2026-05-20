import { NextResponse } from "next/server";
import { categoryTrends } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await categoryTrends(6);
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
