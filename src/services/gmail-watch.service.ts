import { prisma } from "../lib/prisma";
import { getGmailProfile, watchGmailInbox, withGmailAuth } from "./gmail";

const WATCH_TOPIC_NAME = process.env.GMAIL_PUBSUB_TOPIC;
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;

function getWatchModel() {
    const watchModel = (prisma as any).gmailWatch;
    if (!watchModel) {
        throw new Error("gmail watch model not available");
    }
    return watchModel;
}

function toExpirationDate(expiration: string | number) {
    const numeric = typeof expiration === "string" ? Number(expiration) : expiration;
    return new Date(Number.isFinite(numeric) ? numeric : Date.now());
}

export async function getStoredGmailWatch(email?: string) {
    const watchModel = getWatchModel();
    if (email) {
        return watchModel.findUnique({ where: { email } });
    }
    return watchModel.findFirst({ orderBy: { updatedAt: "desc" } });
}

export async function saveGmailWatch(email: string, historyId: string, expiration: string | number) {
    const watchModel = getWatchModel();
    const expirationDate = toExpirationDate(expiration);
    return watchModel.upsert({
        where: { email },
        update: { historyId, expiration: expirationDate },
        create: { email, historyId, expiration: expirationDate },
    });
}

export async function startGmailWatch() {
    if (!WATCH_TOPIC_NAME) {
        throw new Error("GMAIL_PUBSUB_TOPIC is not configured");
    }

    return withGmailAuth(async (accessToken) => {
        const profile = await getGmailProfile(accessToken);
        const response = await watchGmailInbox(accessToken, WATCH_TOPIC_NAME);
        const email = String(profile.emailAddress || "").trim().toLowerCase();

        if (!email) {
            throw new Error("Unable to resolve Gmail account email");
        }

        const watch = await saveGmailWatch(email, String(response.historyId), response.expiration);
        return { profile, watch, response };
    });
}

export async function renewGmailWatch(email?: string) {
    const watch = await getStoredGmailWatch(email);
    if (!watch) {
        return null;
    }

    if (!WATCH_TOPIC_NAME) {
        throw new Error("GMAIL_PUBSUB_TOPIC is not configured");
    }

    return withGmailAuth(async (accessToken) => {
        const profile = await getGmailProfile(accessToken);
        const response = await watchGmailInbox(accessToken, WATCH_TOPIC_NAME);
        const nextEmail = String(profile.emailAddress || watch.email).trim().toLowerCase();
        const updated = await saveGmailWatch(nextEmail, String(response.historyId), response.expiration);
        return { profile, watch: updated, response };
    });
}

export async function renewExpiringGmailWatches() {
    const watch = await getStoredGmailWatch();
    if (!watch) {
        return null;
    }

    const expiresAt = new Date(watch.expiration).getTime();
    if (Number.isNaN(expiresAt) || expiresAt - Date.now() > RENEW_WITHIN_MS) {
        return watch;
    }

    return renewGmailWatch(watch.email);
}

export async function ensureActiveGmailWatch() {
    const watch = await getStoredGmailWatch();
    if (!watch) {
        return startGmailWatch();
    }

    const expiresAt = new Date(watch.expiration).getTime();
    if (Number.isNaN(expiresAt) || expiresAt - Date.now() <= RENEW_WITHIN_MS) {
        return renewGmailWatch(watch.email);
    }

    return watch;
}
