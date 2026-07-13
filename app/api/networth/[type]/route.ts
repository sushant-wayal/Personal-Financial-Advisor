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

const typeToCronPath: Record<string, string> = {
    mutualFund: "/api/cron/mutual-funds/nav",
    stock: "/api/cron/stocks/price",
    vehicleAsset: "/api/cron/vehicles/valuation",
    plotAsset: "/api/cron/plots/valuation",
    independentPropertyAsset: "/api/cron/independent-property/valuation",
    apartmentAsset: "/api/cron/apartments/valuation",
    jewelleryAsset: "/api/cron/jewellery/daily"
};

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ type: string }> }
) {
    try {
        const { type } = await params;

        if (!ALLOWED_TYPES.includes(type)) {
            return NextResponse.json({ error: "Invalid networth type" }, { status: 400 });
        }

        const data = await req.json();

        // Dynamically call the correct prisma model
        // @ts-ignore
        const created = await prisma[type].create({
            data
        });

        // Trigger valuation sync if applicable
        const cronPath = typeToCronPath[type];
        if (cronPath) {
            try {
                const cronUrl = `${req.nextUrl.origin}${cronPath}`;
                console.log(`[POST ${type}] Triggering valuation sync at ${cronUrl}`);
                // Fire and await so Vercel doesn't kill the function before it finishes
                await fetch(cronUrl, {
                    headers: {
                        'authorization': `Bearer ${process.env.CRON_SECRET}`
                    }
                });
            } catch (err) {
                console.error(`[POST ${type}] Failed to trigger cron:`, err);
            }
        }

        return NextResponse.json(created);
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to create record" }, { status: 500 });
    }
}
