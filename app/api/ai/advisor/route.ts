import { NextResponse } from "next/server";
import { askAdvisor } from "../../../../src/services/aiContext";

export async function POST(req: Request) {
    try {
        const { question } = await req.json();
        if (!question) return NextResponse.json({ error: "missing question" }, { status: 400 });
        const resp = await askAdvisor(question);
        return NextResponse.json({ ok: true, result: resp });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
