import { prisma } from "../lib/prisma";
import { extractEmailBody, fetchGmailMessage, getHeaderValue, listGmailHistory, searchGmailMessages } from "./gmail";
import { getConfiguredFinancialSenders, isApprovedFinancialSender } from "./gmail-sender-filter";
import { ingestTransaction } from "./transactionIngestion";
import { getStoredGmailWatch, renewGmailWatch, startGmailWatch } from "./gmail-watch.service";

const HISTORY_FALLBACK_DAYS = Number(process.env.GMAIL_HISTORY_FALLBACK_DAYS || 7);

type GmailHistorySyncInput = {
    emailAddress?: string;
    notificationHistoryId?: string;
    accessToken: string;
};

type GmailMessageItem = {
    id: string;
    internalDate?: string;
    payload?: any;
    snippet?: string;
};

function getWatchModel() {
    const watchModel = (prisma as any).gmailWatch;
    if (!watchModel) {
        throw new Error("gmail watch model not available");
    }
    return watchModel;
}

async function loadConfiguredSenders() {
    try {
        return await getConfiguredFinancialSenders();
    } catch (error) {
        console.error("[gmail-history] failed to load senders", error);
        return [];
    }
}

async function processMessage(accessToken: string, messageId: string, configuredSenders: string[]) {
    try {
        const message = await fetchGmailMessage(accessToken, messageId) as GmailMessageItem;
        const fromHeader = getHeaderValue(message.payload, "From");

        if (!(await isApprovedFinancialSender(fromHeader, configuredSenders))) {
            return { messageId, skipped: true, reason: "sender-not-approved" };
        }

        const rawText = String(extractEmailBody(message.payload) || message.snippet || "").trim();
        const subject = getHeaderValue(message.payload, "Subject") || "";
        const content = rawText || String(subject).trim();

        if (!content) {
            return { messageId, skipped: true, reason: "empty-message" };
        }

        const result = await ingestTransaction({
            raw: content,
            rawText: content,
            source: "gmail",
            sourceMessageId: messageId,
            timestamp: message.internalDate ? new Date(Number(message.internalDate)) : undefined,
        });

        return { messageId, skipped: false, duplicate: Boolean((result as any).duplicate), transaction: (result as any).transaction };
    } catch (error) {
        console.error("[gmail-history] message processing failed", { messageId, error });
        return { messageId, skipped: true, reason: "processing-failed" };
    }
}

async function collectHistoryMessageIds(accessToken: string, startHistoryId: string) {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = startHistoryId;

    do {
        const response = await listGmailHistory(accessToken, startHistoryId, pageToken);
        latestHistoryId = String(response.historyId || latestHistoryId);
        for (const record of response.history || []) {
            for (const item of record.messagesAdded || []) {
                if (item?.message?.id) messageIds.add(String(item.message.id));
            }
            for (const item of record.labelsAdded || []) {
                if (item?.message?.id && Array.isArray(item.labelIds) && item.labelIds.includes("INBOX")) {
                    messageIds.add(String(item.message.id));
                }
            }
        }
        pageToken = response.nextPageToken;
    } while (pageToken);

    return { messageIds: Array.from(messageIds), latestHistoryId };
}

async function recoverWithRecentSenderSearch(accessToken: string, configuredSenders: string[]) {
    if (!configuredSenders.length) {
        return { processed: [], fallbackUsed: true };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_FALLBACK_DAYS);
    const y = cutoff.getFullYear();
    const m = String(cutoff.getMonth() + 1).padStart(2, "0");
    const d = String(cutoff.getDate()).padStart(2, "0");
    const fromQuery = configuredSenders.map((sender) => `from:${sender}`).join(" OR ");
    const query = configuredSenders.length > 1 ? `(${fromQuery}) after:${y}/${m}/${d}` : `${fromQuery} after:${y}/${m}/${d}`;
    const messages = await searchGmailMessages(accessToken, query, 100);

    const processed = [];
    for (const message of messages) {
        if (!message?.id) continue;
        processed.push(await processMessage(accessToken, String(message.id), configuredSenders));
    }

    return { processed, fallbackUsed: true };
}

async function persistWatchHistory(email: string, historyId: string, expiration?: string | number) {
    const watchModel = getWatchModel();
    const existing = await watchModel.findUnique({ where: { email } });
    const expirationDate = expiration ? new Date(typeof expiration === "string" ? Number(expiration) : expiration) : existing?.expiration;

    if (existing) {
        return watchModel.update({
            where: { email },
            data: {
                historyId,
                ...(expirationDate ? { expiration: expirationDate } : {}),
            },
        });
    }

    return watchModel.create({
        data: {
            email,
            historyId,
            expiration: expirationDate || new Date(),
        },
    });
}

export async function syncGmailIncrementally(input: GmailHistorySyncInput) {
    const configuredSenders = await loadConfiguredSenders();
    if (!configuredSenders.length) {
        return { ok: true, processed: [], skipped: [], messageIds: [], reason: "no-configured-senders" };
    }

    const watch = await getStoredGmailWatch(input.emailAddress);
    if (!watch) {
        const recovery = await recoverWithRecentSenderSearch(input.accessToken, configuredSenders);
        await startGmailWatch();
        return { ok: true, watchMissing: true, ...recovery };
    }

    const startHistoryId = String(watch.historyId || input.notificationHistoryId || "");
    if (!startHistoryId) {
        const recovery = await recoverWithRecentSenderSearch(input.accessToken, configuredSenders);
        await renewGmailWatch(watch.email);
        return { ok: true, ...recovery };
    }

    try {
        const { messageIds, latestHistoryId } = await collectHistoryMessageIds(input.accessToken, startHistoryId);
        const processed = [];
        const skipped = [];

        for (const messageId of messageIds) {
            const result = await processMessage(input.accessToken, messageId, configuredSenders);
            if ((result as any).skipped) skipped.push(result);
            else processed.push(result);
        }

        const nextHistoryId = input.notificationHistoryId || latestHistoryId || startHistoryId;
        await persistWatchHistory(watch.email, String(nextHistoryId), watch.expiration);

        return {
            ok: true,
            processed,
            skipped,
            messageIds,
            historyId: nextHistoryId,
            fallbackUsed: false,
        };
    } catch (error: any) {
        const status = error?.response?.status;
        const reason = error?.response?.data?.error?.errors?.[0]?.reason || error?.response?.data?.error?.message;
        console.error("[gmail-history] incremental sync failed", { status, reason, error });

        if (status === 404 || reason === "historyIdInvalid" || reason === "failedPrecondition") {
            const recovery = await recoverWithRecentSenderSearch(input.accessToken, configuredSenders);
            const renewed = await renewGmailWatch(watch.email).catch((renewError) => {
                console.error("[gmail-history] watch renewal after recovery failed", renewError);
                return null;
            });

            return {
                ok: true,
                fallbackUsed: true,
                recovery,
                renewed: Boolean(renewed),
            };
        }

        throw error;
    }
}
