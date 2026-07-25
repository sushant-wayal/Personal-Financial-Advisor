import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const budget = await prisma.categoryBudget.update({
      where: { id },
      data: {
        monthlyLimit: body.monthlyLimit,
        rollover: body.rollover,
      },
    });

    return NextResponse.json({ ok: true, budget });
  } catch (error: any) {
    console.error("Failed to update budget", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await prisma.categoryBudget.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Failed to delete budget", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
