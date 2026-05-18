import { NextResponse } from "next/server";
import { deterministicParse } from "../../../src/services/transactionParser";
import { prisma } from "../../../src/lib/prisma";
import { autoCategorize, findOrCreateCategory } from "../../../src/services/categorizer";

export async function POST(req: Request) {
    const body = await req.json();
    const raw = body.raw || JSON.stringify(body);

    const hasStructuredFields =
        body.amount !== undefined ||
        body.merchant !== undefined ||
        body.category !== undefined ||
        body.categoryId !== undefined ||
        body.transactionType !== undefined ||
        body.type !== undefined ||
        body.paymentMethod !== undefined ||
        body.bankName !== undefined ||
        body.account !== undefined ||
        body.notes !== undefined ||
        body.timestamp !== undefined;

    if (hasStructuredFields && (body.amount !== undefined || body.merchant)) {
        const amount = Number(body.amount);
        const merchant = String(body.merchant || "").trim() || "Unknown";
        const timestamp = body.timestamp && !isNaN(new Date(body.timestamp).getTime())
            ? new Date(body.timestamp)
            : new Date();
        const transactionType = String(body.transactionType || body.type || "OTHER").toUpperCase();
        let categoryId: string | null = null;

        if (body.categoryId) {
            const existing = await prisma.category.findUnique({ where: { id: String(body.categoryId) } });
            categoryId = existing?.id || null;
        }

        if (!categoryId && body.category) {
            const category = await findOrCreateCategory(String(body.category));
            categoryId = category.id;
        }

        if (!categoryId) {
            const catInfo = await autoCategorize(merchant, {
                rawText: body.rawText || raw,
                transactionType,
                fallback: body.category,
            });
            const category = await findOrCreateCategory(catInfo.category);
            categoryId = category.id;
        }

        const tx = await prisma.transaction.create({
            data: {
                amount: Number.isFinite(amount) ? amount : 0,
                merchant,
                categoryId,
                timestamp,
                source: body.source || "manual",
                account: body.account || null,
                type: transactionType,
                notes: body.notes || null,
                confidence: typeof body.confidence === "number" ? Math.min(body.confidence, 1) : 1,
                raw,
            },
            include: { category: true },
        });

        await prisma.$executeRaw`
            UPDATE "Transaction"
            SET "paymentMethod" = ${body.paymentMethod || null},
                "bankName" = ${body.bankName || null},
                "transactionType" = ${transactionType},
                "rawText" = ${body.rawText || raw}
            WHERE "id" = ${tx.id}
        `;

        return NextResponse.json({
            ok: true,
            transaction: {
                ...tx,
                paymentMethod: body.paymentMethod || null,
                bankName: body.bankName || null,
                transactionType,
                rawText: body.rawText || raw,
            },
        });
    }

    const parsed = deterministicParse(raw);
    const catInfo = await autoCategorize(parsed.merchant, {
        rawText: parsed.rawText || raw,
        transactionType: parsed.transactionType,
        fallback: parsed.category,
    });
    const category = await findOrCreateCategory(catInfo.category);

    const tx = await prisma.transaction.create({
        data: {
            amount: parsed.amount,
            merchant: parsed.merchant,
            categoryId: category.id,
            timestamp: parsed.timestamp && !isNaN(new Date(parsed.timestamp).getTime()) ? new Date(parsed.timestamp) : new Date(),
            source: parsed.source || "email",
            account: parsed.account || null,
            type: parsed.type || "OTHER",
            notes: parsed.notes || null,
            confidence: Math.min(parsed.confidence ?? 0.6, catInfo.confidence),
            raw: parsed.raw || raw,
        },
        include: { category: true },
    });

    await prisma.$executeRaw`
        UPDATE "Transaction"
        SET "paymentMethod" = ${parsed.paymentMethod || null},
            "bankName" = ${parsed.bankName || null},
            "transactionType" = ${parsed.transactionType || parsed.type || "OTHER"},
            "rawText" = ${parsed.rawText || raw}
        WHERE "id" = ${tx.id}
    `;

    return NextResponse.json({
        ok: true,
        transaction: {
            ...tx,
            paymentMethod: parsed.paymentMethod || null,
            bankName: parsed.bankName || null,
            transactionType: parsed.transactionType || parsed.type || "OTHER",
            rawText: parsed.rawText || raw,
        },
    });
}
