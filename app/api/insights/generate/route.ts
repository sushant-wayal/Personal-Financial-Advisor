import { NextResponse } from "next/server";
import { generateInsights, listInsights } from "../../../../src/services/insights";

export async function GET() {
    try {
        const insights = await listInsights(50);
        return NextResponse.json({ ok: true, insights });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST() {
    try {
        const generated = await generateInsights(200);
        return NextResponse.json({ ok: true, insights: generated });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
