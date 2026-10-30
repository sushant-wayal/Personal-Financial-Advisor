import { NextResponse } from "next/server";
import { dispatchDirectNotification } from "../../../../src/services/proactiveIntelligence/notifier";

export async function POST() {
  try {
    const delivered = await dispatchDirectNotification({
      title: "🔔 Test Notification from North",
      body: "Proactive intelligence notification delivery is active and verified!",
      route: "/",
      metadata: { isTest: true },
    });

    return NextResponse.json({
      ok: true,
      delivered,
      message: delivered
        ? "Test notification dispatched successfully across external channels and saved to in-app memory."
        : "Test notification saved to in-app memory. (No active Expo push token or external webhook configured yet).",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to dispatch test notification";
    console.error("[api/notifications/test] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

