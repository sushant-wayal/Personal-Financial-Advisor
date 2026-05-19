import { NextResponse } from "next/server";
import { analyzeBehavior } from "../../../../src/services/behavior";
import { generateInsights, listInsights } from "../../../../src/services/insights";
import { pruneOldInsights } from "../../../../src/services/insightStore";

export async function GET() {
    try {
        await pruneOldInsights();
        const insights = await listInsights(50);
        return NextResponse.json({ ok: true, insights });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST() {
    try {
        await pruneOldInsights();
        const behaviorInsights = await analyzeBehavior();
        const generatedInsights = await generateInsights(200);
        return NextResponse.json({ ok: true, insights: [...behaviorInsights, ...generatedInsights] });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
