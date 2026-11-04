import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
    try {
        const [types, methods, goals] = await Promise.all([
            prisma.$queryRaw<{ transactionType: string | null }[]>`
                SELECT DISTINCT "transactionType"
                FROM "Transaction"
                WHERE "transactionType" IS NOT NULL
            `,
            prisma.$queryRaw<{ paymentMethod: string | null }[]>`
                SELECT DISTINCT "paymentMethod"
                FROM "Transaction"
                WHERE "paymentMethod" IS NOT NULL
            `,
            prisma.goal.findMany({
                where: { status: "ACTIVE" },
                select: { id: true, title: true },
                orderBy: { priority: "asc" },
            }),
        ]);

        const transactionTypes = types
            .map((item) => item.transactionType)
            .filter((value): value is string => Boolean(value));

        const paymentMethods = methods
            .map((item) => item.paymentMethod)
            .filter((value): value is string => Boolean(value));

        return NextResponse.json({ transactionTypes, paymentMethods, goals });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
