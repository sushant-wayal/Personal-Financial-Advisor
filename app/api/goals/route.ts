import { NextResponse } from "next/server";
import { listGoals, createGoal } from "../../../src/services/goals";

function asFiniteNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
    const goals = await listGoals();
    return NextResponse.json({ ok: true, goals });
}

export async function POST(req: Request) {
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const targetAmount = asFiniteNumber(body?.targetAmount);
    const priority = body?.priority == null ? undefined : asFiniteNumber(body.priority);
    const initialAllocation = body?.initialAllocation == null ? 0 : asFiniteNumber(body.initialAllocation);

    if (!title) {
        return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (targetAmount == null || targetAmount <= 0) {
        return NextResponse.json({ error: "targetAmount must be a positive number" }, { status: 400 });
    }

    if (priority != null && (!Number.isInteger(priority) || priority < 1 || priority > 5)) {
        return NextResponse.json({ error: "priority must be an integer between 1 and 5" }, { status: 400 });
    }

    if (initialAllocation != null && initialAllocation < 0) {
        return NextResponse.json({ error: "initialAllocation cannot be negative" }, { status: 400 });
    }

    if (body?.targetDate != null) {
        const parsedDate = new Date(body.targetDate);
        if (Number.isNaN(parsedDate.getTime())) {
            return NextResponse.json({ error: "targetDate must be a valid date" }, { status: 400 });
        }
    }

    const g = await createGoal({
        title,
        targetAmount,
        targetDate: body.targetDate,
        priority: priority == null ? undefined : priority,
        notes: typeof body?.notes === "string" ? body.notes : undefined,
        initialAllocation: initialAllocation ?? 0,
    });
    return NextResponse.json({ ok: true, goal: g });
}
