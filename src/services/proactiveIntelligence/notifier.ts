/**
 * proactiveIntelligence/notifier.ts — Direct User Notification Dispatcher.
 *
 * Dispatches notifications directly to the user (via Mobile Push and Webhook/Email)
 * WITHOUT storing notifications in the database or requiring an in-app inbox.
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

  // Channel 1: Mobile Push Notification (Expo Push HTTP API)
  try {
    const pushDelivered = await sendExpoPushNotification(payload);
    if (pushDelivered) delivered = true;
  } catch (err) {
    console.warn("[notifier] Mobile push dispatch notice:", err);
  }

  // Channel 2: External Webhook (Telegram, Discord, Slack, Pushover, NTFY, etc.)
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
    console.info("[notifier] No registered Expo push token found in AIMemory or EXPO_PUSH_TOKEN. Push notification skipped.");
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

  const ticketData = res.data?.data;
  if (ticketData?.status === "ok") {
    console.info(`[notifier] Expo Push dispatched successfully. Ticket ID: ${ticketData.id}`);
    return true;
  } else if (ticketData?.status === "error") {
    console.warn(`[notifier] Expo Push returned error status: ${ticketData.message ?? ticketData.details?.error ?? "Unknown error"}`);
    return false;
  }

  return res.status >= 200 && res.status < 300;
}

/**
 * Send notification to an external webhook (e.g. Discord, Telegram, Pushover, NTFY) if configured.
 */
async function sendWebhookNotification(payload: DirectNotificationPayload): Promise<boolean> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
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
