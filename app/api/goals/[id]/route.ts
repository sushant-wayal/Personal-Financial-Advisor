import { NextResponse } from "next/server";
import { updateGoal, deleteGoal } from "../../../../src/services/goals";

function asFiniteNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body || Object.keys(body).length === 0) {
            return NextResponse.json({ error: "missing fields" }, { status: 400 });
        }

        const allowedKeys = new Set(["title", "targetAmount", "currentAmount", "monthlyTarget", "targetDate", "priority", "notes"]);
        const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
        if (unknownKeys.length > 0) {
            return NextResponse.json({ error: `unknown fields: ${unknownKeys.join(", ")}` }, { status: 400 });
        }

        const patch: Record<string, unknown> = {};

        if ("title" in body) {
            if (typeof body.title !== "string" || !body.title.trim()) {
                return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
            }
            patch.title = body.title.trim();
        }

        if ("targetAmount" in body) {
            const targetAmount = asFiniteNumber(body.targetAmount);
            if (targetAmount == null || targetAmount <= 0) {
                return NextResponse.json({ error: "targetAmount must be a positive number" }, { status: 400 });
            }
            patch.targetAmount = targetAmount;
        }

        if ("currentAmount" in body) {
            const currentAmount = asFiniteNumber(body.currentAmount);
            if (currentAmount == null || currentAmount < 0) {
                return NextResponse.json({ error: "currentAmount must be a non-negative number" }, { status: 400 });
            }
            patch.currentAmount = currentAmount;
        }

        if ("monthlyTarget" in body) {
            const monthlyTarget = asFiniteNumber(body.monthlyTarget);
            if (monthlyTarget == null || monthlyTarget < 0) {
                return NextResponse.json({ error: "monthlyTarget must be a non-negative number" }, { status: 400 });
            }
            patch.monthlyTarget = monthlyTarget;
        }

        if ("priority" in body) {
            const priority = asFiniteNumber(body.priority);
            if (priority == null || !Number.isInteger(priority) || priority < 1 || priority > 5) {
                return NextResponse.json({ error: "priority must be an integer between 1 and 5" }, { status: 400 });
            }
            patch.priority = priority;
        }

        if ("targetDate" in body) {
            if (body.targetDate == null || body.targetDate === "") {
                patch.targetDate = null;
            } else {
                const parsedDate = new Date(body.targetDate);
                if (Number.isNaN(parsedDate.getTime())) {
                    return NextResponse.json({ error: "targetDate must be a valid date" }, { status: 400 });
                }
                patch.targetDate = body.targetDate;
            }
        }

        if ("notes" in body && typeof body.notes === "string") {
            patch.notes = body.notes;
        }

        if (Object.keys(patch).length === 0) {
            return NextResponse.json({ error: "no valid fields to update" }, { status: 400 });
        }

        const goal = await updateGoal(id, patch as any);
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
