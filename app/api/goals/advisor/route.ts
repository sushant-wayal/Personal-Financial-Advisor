import { NextResponse } from "next/server";
import { adviseGoals } from "../../../../src/services/GoalAdvisorService";

export async function GET() {
    try {
        const result = await adviseGoals({ persist: true });
        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
