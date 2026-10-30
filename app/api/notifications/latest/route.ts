import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
  try {
    const memory = await prisma.aIMemory.findFirst({
      where: { key: "latest_proactive_notification" },
    });

    if (!memory || !memory.value) {
      return NextResponse.json({ ok: true, notification: null });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(memory.value);
    } catch {
      return NextResponse.json({ ok: true, notification: null });
    }

    if (!parsed || parsed.dismissed) {
      return NextResponse.json({ ok: true, notification: null });
    }

    // Check if notification is from today's IST session date
    const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (parsed.sessionDate !== todayIst) {
      return NextResponse.json({ ok: true, notification: null, isStale: true });
    }

    return NextResponse.json({ ok: true, notification: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notification";
    console.error("[api/notifications/latest] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

