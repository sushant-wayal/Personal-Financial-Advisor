import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { getEnrichedBudgets } from "@/src/services/budgets";

export async function GET(_request: Request) {
  try {
    const [enrichedBudgets, categories] = await Promise.all([
      getEnrichedBudgets(),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ ok: true, budgets: enrichedBudgets, categories });
  } catch (error: any) {
    console.error("Failed to fetch budgets", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { categoryId, monthlyLimit, rollover } = await request.json();

    if (!categoryId || typeof monthlyLimit !== 'number') {
      return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const budget = await prisma.categoryBudget.create({
      data: {
        categoryId,
        monthlyLimit,
        rollover: rollover ?? false,
      },
      include: {
        category: true,
      }
    });

    return NextResponse.json({ ok: true, budget });
  } catch (error: any) {
    console.error("Failed to create budget", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
