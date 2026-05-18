import { NextResponse } from "next/server";
import { deterministicParse } from "../../../src/services/transactionParser";
import { prisma } from "../../../src/lib/prisma";
import { autoCategorize } from "../../../src/services/categorizer";

export async function POST(req: Request) {
    const body = await req.json();
    const raw = body.raw || JSON.stringify(body);

    const parsed = deterministicParse(raw);
    const catInfo = await autoCategorize(parsed.merchant, parsed.category);

    // Find or create the category
    const category = await prisma.category.upsert({
        where: { name: catInfo.category },
        update: {},
        create: { name: catInfo.category },
    });

    const tx = await prisma.transaction.create({
        data: {
            amount: parsed.amount,
            merchant: parsed.merchant,
            categoryId: category.id,
            timestamp: parsed.timestamp && !isNaN(new Date(parsed.timestamp).getTime()) ? new Date(parsed.timestamp) : new Date(),
            source: parsed.source || "email",
            account: parsed.account || null,
            type: parsed.type as any,
            notes: parsed.notes || null,
            confidence: parsed.confidence ?? 0.6,
            raw: parsed.raw || raw,
        },
    });

    return NextResponse.json({ ok: true, transaction: tx });
}
