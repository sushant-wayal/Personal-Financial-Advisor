import { NextResponse } from "next/server";
import { calculateRunway } from "../../../../src/services/analytics";

export async function GET() {
    try {
        const data = await calculateRunway();
        return NextResponse.json({ ok: true, data });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
