import { NextResponse } from "next/server";
import { prisma } from "../../../../../src/lib/prisma";
import { findOrCreateCategory, teachMerchantCategory } from "../../../../../src/services/categorizer";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        if (!body.category) return NextResponse.json({ error: "missing category" }, { status: 400 });

        const category = await findOrCreateCategory(body.category);
        const tx = await prisma.transaction.update({
            where: { id },
            data: {
                categoryId: category.id,
                confidence: body.confidence ?? 0.98,
            },
            include: { category: true },
        });
        // teach mapping for future
        await teachMerchantCategory(tx.merchant, category.name);
        return NextResponse.json({ ok: true, transaction: tx });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
