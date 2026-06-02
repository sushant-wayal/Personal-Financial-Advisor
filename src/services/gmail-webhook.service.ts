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

type DecodedPushEnvelope =
    | { ok: true; payload: Required<GmailPushPayload>; decodedKeys: string[] }
    | { ok: false; reason: string; decodedKeys?: string[] };

function decodeBase64Url(value: string) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
}

function readPayloadField(payload: Record<string, unknown>, names: string[]) {
    for (const name of names) {
        const value = payload[name];
        if (value !== undefined && value !== null && String(value).trim()) {
            return String(value).trim();
        }
    }
    return undefined;
}

function decodePushEnvelope(body: PubSubEnvelope): DecodedPushEnvelope {
    const encodedData = body?.message?.data;
    if (!encodedData) {
        return { ok: false, reason: "missing-pubsub-message-data" };
    }

    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(decodeBase64Url(encodedData)) as Record<string, unknown>;
    } catch {
        return { ok: false, reason: "invalid-pubsub-json" };
    }

    const decodedKeys = Object.keys(payload);
    const emailAddress = readPayloadField(payload, ["emailAddress", "email", "email_address", "userEmail"]);
    const historyId = readPayloadField(payload, ["historyId", "historyID", "history_id"]);

    if (!emailAddress || !historyId) {
        return { ok: false, reason: "invalid-gmail-notification-payload", decodedKeys };
    }

    return {
        ok: true,
        decodedKeys,
        payload: {
            emailAddress: emailAddress.toLowerCase(),
            historyId,
        },
    };
}

export async function handleGmailWebhookPush(rawBody: PubSubEnvelope) {
    console.info("[gmail-webhook] received push notification", {
        hasMessage: Boolean(rawBody?.message),
        subscription: rawBody?.subscription,
        messageId: rawBody?.message?.messageId,
    });
    const decoded = decodePushEnvelope(rawBody);

    if (!decoded.ok) {
        console.warn("[gmail-webhook] malformed push payload, attempting watch-based recovery", {
            reason: decoded.reason,
            decodedKeys: decoded.decodedKeys,
            subscription: rawBody?.subscription,
            messageId: rawBody?.message?.messageId,
        });

        const watch = await getStoredGmailWatch();
        if (!watch) {
            return {
                ok: true,
                ignored: true,
                reason: decoded.reason,
                recovered: false,
            };
        }

        await withGmailAuth(async (accessToken) => {
            console.info("[gmail-webhook] starting recovery incremental sync", {
                emailAddress: watch.email,
                storedHistoryId: watch.historyId,
            });
            await syncGmailIncrementally({
                accessToken,
                emailAddress: watch.email,
            });
        });

        return {
            ok: true,
            accepted: true,
            recovered: true,
            reason: decoded.reason,
        };
    }

    const payload = decoded.payload;
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
