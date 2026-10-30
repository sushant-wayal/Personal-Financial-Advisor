import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

async function upsertMemory(key: string, value: string) {
  const existing = await prisma.aIMemory.findFirst({ where: { key } });
  if (existing) {
    return prisma.aIMemory.update({
      where: { id: existing.id },
      data: { value, updatedAt: new Date() },
    });
  }
  return prisma.aIMemory.create({
    data: { key, value },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { expoPushToken, webhookUrl } = body;

    if (expoPushToken !== undefined) {
      if (typeof expoPushToken === "string" && expoPushToken.trim().length > 0) {
        await upsertMemory("expo_push_token", expoPushToken.trim());
      } else if (expoPushToken === "" || expoPushToken === null) {
        // Clear token
        await prisma.aIMemory.deleteMany({ where: { key: "expo_push_token" } });
      }
    }

    if (webhookUrl !== undefined) {
      if (typeof webhookUrl === "string" && webhookUrl.trim().length > 0) {
        await upsertMemory("notification_webhook_url", webhookUrl.trim());
      } else if (webhookUrl === "" || webhookUrl === null) {
        // Clear webhook
        await prisma.aIMemory.deleteMany({ where: { key: "notification_webhook_url" } });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Notification destinations saved successfully.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register notification destination";
    console.error("[api/notifications/register-token] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

