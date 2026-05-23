import { withGmailAuth } from "./gmail";
import { syncGmailIncrementally } from "./gmail-history.service";
import { getStoredGmailWatch } from "./gmail-watch.service";

type PubSubEnvelope = {
    message?: {
        data?: string;
        messageId?: string;
        publishTime?: string;
        attributes?: Record<string, string>;
    };
    subscription?: string;
};

type GmailPushPayload = {
    emailAddress?: string;
    historyId?: string;
};

function decodePushEnvelope(body: PubSubEnvelope): GmailPushPayload {
    const encodedData = body?.message?.data;
    if (!encodedData) {
        throw new Error("missing Pub/Sub message data");
    }

    const decoded = Buffer.from(encodedData, "base64").toString("utf-8");
    const payload = JSON.parse(decoded) as GmailPushPayload;
    if (!payload?.emailAddress || !payload?.historyId) {
        throw new Error("invalid Gmail notification payload");
    }

    return {
        emailAddress: String(payload.emailAddress).trim().toLowerCase(),
        historyId: String(payload.historyId),
    };
}

export async function handleGmailWebhookPush(rawBody: PubSubEnvelope) {
    console.info("[gmail-webhook] received push notification", {
        hasMessage: Boolean(rawBody?.message),
        subscription: rawBody?.subscription,
        messageId: rawBody?.message?.messageId,
    });
    const payload = decodePushEnvelope(rawBody);
    console.info("[gmail-webhook] decoded payload", payload);
    const watch = await getStoredGmailWatch(payload.emailAddress);

    if (!watch) {
        console.warn("[gmail-webhook] no watch found for account", { emailAddress: payload.emailAddress });
        return { ok: true, ignored: true, reason: "watch-not-found", payload };
    }

    console.info("[gmail-webhook] loaded watch", {
        email: watch.email,
        storedHistoryId: watch.historyId,
        incomingHistoryId: payload.historyId,
        expiration: watch.expiration,
    });

    if (String(payload.historyId) === String(watch.historyId)) {
        console.info("[gmail-webhook] duplicate history id ignored", { emailAddress: payload.emailAddress, historyId: payload.historyId });
        return { ok: true, ignored: true, reason: "duplicate-history-id", payload };
    }

    await withGmailAuth(async (accessToken) => {
        console.info("[gmail-webhook] starting incremental sync", {
            emailAddress: payload.emailAddress,
            notificationHistoryId: payload.historyId,
        });
        await syncGmailIncrementally({
            accessToken,
            emailAddress: payload.emailAddress,
            notificationHistoryId: payload.historyId,
        });
    });

    console.info("[gmail-webhook] incremental sync finished", {
        emailAddress: payload.emailAddress,
        historyId: payload.historyId,
    });

    return { ok: true, accepted: true, payload };
}
