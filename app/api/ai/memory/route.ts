import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
    try {
        const mem = await prisma.aIMemory.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
        return NextResponse.json({ ok: true, memories: mem });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (!body.key || !body.value) return NextResponse.json({ error: "missing fields" }, { status: 400 });
        const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : body.tags || "[]";
        const created = await prisma.aIMemory.create({ data: { key: body.key, value: body.value, tags } });
        return NextResponse.json({ ok: true, memory: created });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id") || undefined;
        if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
        await prisma.aIMemory.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
