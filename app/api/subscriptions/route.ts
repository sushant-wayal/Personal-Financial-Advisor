import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

export async function GET() {
    try {
        const subscriptions = await prisma.subscription.findMany({ orderBy: { merchant: "asc" } });
        return NextResponse.json({ ok: true, subscriptions });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const id = String(body.id);
        const data = body.data || {};
        const updated = await prisma.subscription.update({
            where: { id }, data: {
                merchant: data.merchant ?? undefined,
                amount: data.amount ?? undefined,
                interval: data.interval ?? undefined,
                nextCharge: data.nextCharge ? new Date(String(data.nextCharge)) : undefined,
                active: typeof data.active === 'boolean' ? data.active : undefined,
            }
        });
        return NextResponse.json({ ok: true, subscription: updated });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const id = String(body.id);
        await prisma.subscription.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
