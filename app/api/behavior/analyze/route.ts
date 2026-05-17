import { NextResponse } from "next/server";
import { analyzeBehavior } from "../../../../src/services/behavior";

export async function POST() {
    try {
        const res = await analyzeBehavior();
        return NextResponse.json({ ok: true, results: res });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
