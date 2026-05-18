import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
    try {
        const [types, methods] = await Promise.all([
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
        ]);

        const transactionTypes = types
            .map((item) => item.transactionType)
            .filter((value): value is string => Boolean(value));

        const paymentMethods = methods
            .map((item) => item.paymentMethod)
            .filter((value): value is string => Boolean(value));

        return NextResponse.json({ transactionTypes, paymentMethods });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
