import { NextResponse } from "next/server";
import { updateGoal, deleteGoal } from "../../../../src/services/goals";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body || Object.keys(body).length === 0) {
            return NextResponse.json({ error: "missing fields" }, { status: 400 });
        }
        const goal = await updateGoal(id, body);
        return NextResponse.json({ ok: true, goal });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const goal = await deleteGoal(id);
        return NextResponse.json({ ok: true, goal });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
