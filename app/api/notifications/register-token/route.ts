import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { expoPushToken } = body;

    if (!expoPushToken || typeof expoPushToken !== "string") {
      return NextResponse.json({ ok: false, error: "expoPushToken string is required" }, { status: 400 });
    }

    const trimmed = expoPushToken.trim();

    // Store push token in AIMemory for use by notifier.ts
    const existing = await prisma.aIMemory.findFirst({
      where: { key: "expo_push_token" },
    });

    if (existing) {
      await prisma.aIMemory.update({
        where: { id: existing.id },
        data: { value: trimmed, updatedAt: new Date() },
      });
    } else {
      await prisma.aIMemory.create({
        data: { key: "expo_push_token", value: trimmed },
      });
    }

    console.info(`[api/notifications/register-token] Registered Expo push token: ${trimmed.slice(0, 18)}...`);
    return NextResponse.json({ ok: true, message: "Device push token registered successfully." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register push token";
    console.error("[api/notifications/register-token] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
