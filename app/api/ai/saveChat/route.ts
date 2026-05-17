import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.key || !body.value) return NextResponse.json({ error: 'missing' }, { status: 400 });
        const created = await prisma.aIMemory.create({ data: { key: body.key, value: body.value, tags: JSON.stringify(['chat']) } });
        return NextResponse.json({ ok: true, memory: created });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
