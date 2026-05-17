import { NextResponse } from "next/server";
import { evaluateAffordability } from "../../../../src/services/affordability";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const price = Number(body.price || 0);
        if (isNaN(price)) return NextResponse.json({ error: "invalid price" }, { status: 400 });
        const res = await evaluateAffordability(price);
        return NextResponse.json({ ok: true, ...res });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
