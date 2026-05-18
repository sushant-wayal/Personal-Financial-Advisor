import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

type BulkDeleteBody = {
    ids?: string[];
    all?: boolean;
};

export async function DELETE(req: Request) {
    try {
        const body = await req.json().catch(() => ({})) as BulkDeleteBody;

        if (body.all) {
            const result = await prisma.transaction.deleteMany();
            return NextResponse.json({ ok: true, deleted: result.count });
        }

        const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string" && id.trim()) : [];
        if (!ids.length) {
            return NextResponse.json({ error: "missing transaction ids" }, { status: 400 });
        }

        const result = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
        return NextResponse.json({ ok: true, deleted: result.count });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
