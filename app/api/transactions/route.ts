import { NextResponse } from "next/server";
import { deterministicParse } from "../../../src/services/transactionParser";
import { prisma } from "../../../src/lib/prisma";
import { autoCategorize, findOrCreateCategory } from "../../../src/services/categorizer";
import { getTransactionImpact, updateProfileBalanceBy } from "../../../src/services/balance";
import { adviseGoals } from "../../../src/services/GoalAdvisorService";
import { getGoalOverview } from "../../../src/services/goals";

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
        body.notes !== undefined ||
        body.timestamp !== undefined;

    if (hasStructuredFields && (body.amount !== undefined || body.merchant)) {
        let amount = Number(body.amount);

        // Normalize amount to always be positive - sign comes from type field only
        const amountWasNegative = amount < 0;
        amount = Math.abs(amount);

        const merchant = String(body.merchant || "").trim() || "Unknown";
        const timestamp = body.timestamp && !isNaN(new Date(body.timestamp).getTime())
            ? new Date(body.timestamp)
            : new Date();
        let transactionType = String(body.transactionType || body.type || "OTHER").toUpperCase();

        // If amount was negative and no CREDIT type specified, treat as DEBIT
        if (amountWasNegative && !body.transactionType && !body.type) {
            transactionType = "DEBIT";
        }
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

        const impact = getTransactionImpact(tx.amount, transactionType, transactionType);
        await updateProfileBalanceBy(impact);

        // Trigger goals recalculation and advisor insights asynchronously
        try {
            await getGoalOverview();
            await adviseGoals({ persist: true });
        } catch (e) {
            // don't fail the transaction creation if advisor fails
            console.error("goal recalculation failed", e);
        }

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

    // Ensure amount is always positive (transactionParser already does this via Math.abs)
    const normalizedAmount = Math.abs(parsed.amount);

    const tx = await prisma.transaction.create({
        data: {
            amount: normalizedAmount,
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

    const impact = getTransactionImpact(tx.amount, parsed.type, parsed.transactionType || parsed.type || "OTHER");
    await updateProfileBalanceBy(impact);

    // Trigger goals recalculation and advisor insights asynchronously
    try {
        await getGoalOverview();
        await adviseGoals({ persist: true });
    } catch (e) {
        console.error("goal recalculation failed", e);
    }

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
