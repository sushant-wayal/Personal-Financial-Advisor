import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function GET() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: {
                name: "asc",
            },
        });
        return NextResponse.json(categories);
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
