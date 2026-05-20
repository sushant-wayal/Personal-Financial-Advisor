import { NextResponse } from "next/server";
import { getGoalOverview } from "../../../../src/services/goals";

export async function GET() {
    try {
        const overview = await getGoalOverview();
        return NextResponse.json({ ok: true, ...overview });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
