import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

const ALLOWED_TYPES = [
    "pPFAccount",
    "ePFAccount",
    "fDAccount",
    "rDAccount",
    "vehicleAsset",
    "plotAsset",
    "independentPropertyAsset",
    "apartmentAsset",
    "jewelleryAsset",
    "receivableAsset",
    "loanLiability",
    "creditCardLiability",
    "bnplLiability",
    "borrowedLiability",
    "mutualFund",
    "stock"
];

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ type: string, id: string }> }
) {
    try {
        const { type, id } = await params;

        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid networth type" }, { status: 400 });
        }

        const data = await req.json();

        // @ts-expect-error - dynamic model name in prisma
        const updated = await prisma[type].update({
            where: { id },
            data
        });

        return NextResponse.json(updated);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to update record" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ type: string, id: string }> }
) {
    try {
        const { type, id } = await params;

        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid networth type" }, { status: 400 });
        }

        // @ts-expect-error - dynamic model name in prisma
        await prisma[type].delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to delete record" }, { status: 500 });
    }
}
