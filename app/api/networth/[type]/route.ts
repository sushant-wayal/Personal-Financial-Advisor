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
    "borrowedLiability"
];

export async function POST(
    req: NextRequest,
    { params }: { params: { type: string } }
) {
    try {
        const type = params.type;

        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid networth type" }, { status: 400 });
        }

        const data = await req.json();

        // Dynamically call the correct prisma model
        // @ts-ignore
        const created = await prisma[type].create({
            data
        });

        return NextResponse.json(created);
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
