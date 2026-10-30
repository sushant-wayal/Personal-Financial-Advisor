import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST() {
  try {
    const memory = await prisma.aIMemory.findFirst({
      where: { key: "latest_proactive_notification" },
    });

    if (memory && memory.value) {
      try {
        const parsed = JSON.parse(memory.value);
        parsed.dismissed = true;
        await prisma.aIMemory.update({
          where: { id: memory.id },
          data: { value: JSON.stringify(parsed), updatedAt: new Date() },
        });
      } catch {
        // ignore parse error
      }
    }

    return NextResponse.json({ ok: true, message: "Notification dismissed." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dismiss notification";
    console.error("[api/notifications/dismiss] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

