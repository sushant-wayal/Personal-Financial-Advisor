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
    const payload = decodePushEnvelope(rawBody);
    const watch = await getStoredGmailWatch(payload.emailAddress);

    if (!watch) {
        return { ok: true, ignored: true, reason: "watch-not-found", payload };
    }

    if (String(payload.historyId) === String(watch.historyId)) {
        return { ok: true, ignored: true, reason: "duplicate-history-id", payload };
    }

    void withGmailAuth(async (accessToken) => {
        await syncGmailIncrementally({
            accessToken,
            emailAddress: payload.emailAddress,
            notificationHistoryId: payload.historyId,
        });
    }).catch((error) => {
        console.error("[gmail-webhook] async processing failed", error);
    });

    return { ok: true, accepted: true, payload };
}
