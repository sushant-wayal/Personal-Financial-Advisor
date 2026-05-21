import { NextResponse } from "next/server";
import { listGoals, createGoal } from "../../../src/services/goals";

export async function GET() {
    const goals = await listGoals();
    return NextResponse.json({ ok: true, goals });
}

export async function POST(req: Request) {
    const body = await req.json();
    if (!body.title || !body.targetAmount) return NextResponse.json({ error: "missing fields" }, { status: 400 });
    const g = await createGoal({
        title: body.title,
        targetAmount: Number(body.targetAmount),
        targetDate: body.targetDate,
        priority: body.priority,
        notes: body.notes,
        initialAllocation: body.initialAllocation,
    });
    return NextResponse.json({ ok: true, goal: g });
}
