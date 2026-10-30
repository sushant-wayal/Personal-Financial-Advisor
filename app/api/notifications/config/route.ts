import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
  try {
    const pushTokenRecord = await prisma.aIMemory.findFirst({
      where: { key: "expo_push_token" },
    });
    const webhookRecord = await prisma.aIMemory.findFirst({
      where: { key: "notification_webhook_url" },
    });

    const pushToken = pushTokenRecord?.value || process.env.EXPO_PUSH_TOKEN || null;
    const webhookUrl = webhookRecord?.value || process.env.NOTIFICATION_WEBHOOK_URL || null;

    const mask = (str: string | null) => {
      if (!str) return null;
      if (str.length <= 10) return "****";
      return `${str.slice(0, 6)}...${str.slice(-4)}`;
    };

    return NextResponse.json({
      ok: true,
      hasPushToken: Boolean(pushToken),
      maskedPushToken: mask(pushToken),
      hasWebhookUrl: Boolean(webhookUrl),
      maskedWebhookUrl: mask(webhookUrl),
      inAppNotificationsActive: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load notification config";
    console.error("[api/notifications/config] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

