import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/prisma";
import { teachMerchantCategory } from "../../../../../src/services/categorizer";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body.category) return NextResponse.json({ error: "missing category" }, { status: 400 });

        const tx = await prisma.transaction.update({ where: { id }, data: { category: body.category } });
        // teach mapping for future
        await teachMerchantCategory(tx.merchant, body.category);
        return NextResponse.json({ ok: true, transaction: tx });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
