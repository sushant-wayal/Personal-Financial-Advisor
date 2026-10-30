/**
 * proactiveIntelligence/notifier.ts — Direct User Notification Dispatcher.
 *
 * Dispatches notifications across multiple channels:
 * 1. Persistent In-App Morning Intel (stored in AIMemory for instant display on Web & Mobile dashboards)
 * 2. Mobile Push Notifications via Expo Push HTTP API
 * 3. External Webhooks (Telegram, Discord, Slack, Pushover, NTFY, etc.)
 */

import axios from "axios";
import { prisma } from "../../lib/prisma";
import type { DirectNotificationPayload } from "./types";

/**
 * Dispatch a direct notification to the user across configured channels.
 */
export async function dispatchDirectNotification(payload: DirectNotificationPayload): Promise<boolean> {
  let delivered = false;

  console.info(`[notifier] 🚀 Dispatching notification: "${payload.title}" -> ${payload.body}`);

  // Channel 1: Persistent In-App Memory (guarantees in-app alert banner on Web & Mobile)
  try {
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const existing = await prisma.aIMemory.findFirst({
      where: { key: "latest_proactive_notification" },
    });
    const notificationValue = JSON.stringify({
      title: payload.title,
      body: payload.body,
      route: payload.route,
      metadata: payload.metadata,
      sessionDate: todayStr,
      createdAt: new Date().toISOString(),
      dismissed: false,
    });

    if (existing) {
      await prisma.aIMemory.update({
        where: { id: existing.id },
        data: { value: notificationValue, updatedAt: new Date() },
      });
    } else {
      await prisma.aIMemory.create({
        data: { key: "latest_proactive_notification", value: notificationValue },
      });
    }
  } catch (err) {
    console.warn("[notifier] Failed to save in-app notification memory:", err);
  }

  // Channel 2: Mobile Push Notification (Expo Push HTTP API)
  try {
    const pushDelivered = await sendExpoPushNotification(payload);
    if (pushDelivered) delivered = true;
  } catch (err) {
    console.warn("[notifier] Mobile push dispatch notice:", err);
  }

  // Channel 3: External Webhook (Telegram, Discord, Slack, Pushover, NTFY, etc.)
  try {
    const webhookDelivered = await sendWebhookNotification(payload);
    if (webhookDelivered) delivered = true;
  } catch (err) {
    console.warn("[notifier] Webhook dispatch notice:", err);
  }

  return delivered;
}

/**
 * Send mobile push notification via Expo Push API.
 */
async function sendExpoPushNotification(payload: DirectNotificationPayload): Promise<boolean> {
  // Check for stored mobile push token in AIMemory or environment variable
  const tokenRecord = await prisma.aIMemory.findFirst({
    where: { key: "expo_push_token" },
  });

  const pushToken = tokenRecord?.value || process.env.EXPO_PUSH_TOKEN;
  if (!pushToken || typeof pushToken !== "string") {
    // No registered device token yet
    return false;
  }

  const expoUrl = "https://exp.host/--/api/v2/push/send";
  const res = await axios.post(
    expoUrl,
    {
      to: pushToken.trim(),
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: { route: payload.route, ...payload.metadata },
    },
    {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      timeout: 5000,
    },
  );

  return res.status >= 200 && res.status < 300;
}

/**
 * Send notification to an external webhook (e.g. Discord, Telegram, Pushover, NTFY) if configured.
 */
async function sendWebhookNotification(payload: DirectNotificationPayload): Promise<boolean> {
  const memoryWebhook = await prisma.aIMemory.findFirst({
    where: { key: "notification_webhook_url" },
  });
  const webhookUrl = memoryWebhook?.value || process.env.NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const content = `**${payload.title}**\n${payload.body}\n[Open in App](${payload.route})`;

  const res = await axios.post(
    webhookUrl,
    {
      content,
      text: content,
      title: payload.title,
      message: payload.body,
    },
    { timeout: 5000 },
  );

  return res.status >= 200 && res.status < 300;
}
