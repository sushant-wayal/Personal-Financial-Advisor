import axios from "axios";
import { prisma } from "../lib/prisma";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth client not configured");

    const params = new URLSearchParams();
    params.append("code", code);
    params.append("client_id", clientId);
    params.append("client_secret", clientSecret);
    params.append("redirect_uri", redirectUri);
    params.append("grant_type", "authorization_code");

    const res = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return res.data;
}

export async function refreshAccessToken(refreshToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const params = new URLSearchParams();
    params.append("refresh_token", refreshToken);
    params.append("client_id", clientId || "");
    params.append("client_secret", clientSecret || "");
    params.append("grant_type", "refresh_token");

    const res = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return res.data;
}

export async function storeTokens(tokens: any) {
    const key = "gmail_oauth_tokens";
    const mem = await prisma.aIMemory.findFirst({ where: { key } });
    const payload = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        expires_at: new Date().getTime() + (tokens.expires_in - 60) * 1000, // 60s buffer
        token_type: tokens.token_type,
    };
    if (mem) {
        await prisma.aIMemory.update({ where: { id: mem.id }, data: { value: JSON.stringify(payload) } });
    } else {
        await prisma.aIMemory.create({ data: { key, value: JSON.stringify(payload), tags: JSON.stringify(["gmail"]) } });
    }
    return payload;
}

export async function getStoredTokens() {
    const key = "gmail_oauth_tokens";
    const mem = await prisma.aIMemory.findFirst({ where: { key } });
    if (!mem) return null;
    try {
        const tokens = JSON.parse(mem.value || "{}");
        // check expiry
        if (tokens.expires_at && new Date().getTime() > tokens.expires_at) {
            console.log("[gmail] token expired, attempting refresh");
            const newTokens = await refreshAccessToken(tokens.refresh_token);
            return await storeTokens({ ...tokens, ...newTokens });
        }
        return tokens;
    } catch (e) { return null; }
}

export async function withGmailAuth<T>(callback: (accessToken: string) => Promise<T>): Promise<T> {
    let tokens = await getStoredTokens();
    if (!tokens?.access_token) {
        throw new Error("Not authenticated with Google");
    }

    try {
        return await callback(tokens.access_token);
    } catch (error: any) {
        if (error.response && error.response.status === 401) {
            console.log("[gmail] Access token failed, refreshing...");
            const newTokens = await refreshAccessToken(tokens.refresh_token);
            tokens = await storeTokens({ ...tokens, ...newTokens });
            if (!tokens?.access_token) {
                throw new Error("Failed to refresh access token");
            }
            // Retry the callback with the new token
            return await callback(tokens.access_token);
        } else {
            // Re-throw other errors
            throw error;
        }
    }
}

export function buildAuthUrl(redirectUri: string, scope = "https://www.googleapis.com/auth/gmail.readonly") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId || "");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("scope", scope);
    url.searchParams.set("prompt", "consent");
    return url.toString();
}

export function decodeBase64Url(data: string) {
    return Buffer.from(
        data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
    ).toString("utf-8");
}

export function extractEmailBody(payload: any): string {
    if (!payload) return "";

    // plain text body
    if (payload.mimeType === "text/plain" && payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    // html body fallback
    if (payload.mimeType === "text/html" && payload.body?.data) {
        return decodeBase64Url(payload.body.data)
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&#39;/gi, "'")
            .replace(/&amp;/gi, "&")
            .replace(/\s+/g, " ")
            .trim();
    }

    // recursive multipart traversal
    if (payload.parts?.length) {
        for (const part of payload.parts) {
            const text = extractEmailBody(part);
            if (text?.trim()) {
                return text;
            }
        }
    }

    // fallback direct body
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    return "";
}

export function getHeaderValue(payload: any, headerName: string): string | undefined {
    const headers = payload?.headers || [];
    const found = headers.find((header: { name?: string; value?: string }) => String(header.name || "").toLowerCase() === headerName.toLowerCase());
    return found?.value;
}

export async function getGmailProfile(accessToken: string) {
    const res = await axios.get(`${GMAIL_API_BASE}/users/me/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
}

export async function fetchGmailMessage(accessToken: string, messageId: string) {
    const res = await axios.get(`${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
}

export async function searchGmailMessages(accessToken: string, query: string, maxResults = 50) {
    const url = `${GMAIL_API_BASE}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.data.messages || [];
}

export async function listGmailHistory(accessToken: string, startHistoryId: string, pageToken?: string) {
    const params = new URLSearchParams();
    params.set("startHistoryId", startHistoryId);
    params.set("maxResults", "500");
    if (pageToken) params.set("pageToken", pageToken);

    const res = await axios.get(`${GMAIL_API_BASE}/users/me/history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
}

export async function watchGmailInbox(accessToken: string, topicName: string) {
    const res = await axios.post(
        `${GMAIL_API_BASE}/users/me/watch`,
        {
            labelIds: ["INBOX"],
            labelFilterAction: "include",
            topicName,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data;
}

export async function fetchUnreadFinancialEmails(accessToken: string, senders: string[], maxResults = 20, afterDate?: string) {
    // search only from explicitly configured senders; support incremental via after:YYYY/MM/DD
    const fromQuery = senders.map((s) => `from:${s}`).join(" OR ");
    let q = senders.length > 1 ? `(${fromQuery})` : fromQuery;
    if (afterDate) {
        // Gmail search accepts after:YYYY/MM/DD
        const d = new Date(afterDate);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        q += ` after:${y}/${m}/${day}`;
    }
    const messages = await searchGmailMessages(accessToken, q, maxResults);
    const out: Array<{ id: string; snippet?: string; internalDate?: string }> = [];
    for (const m of messages) {
        try {
            const r = await fetchGmailMessage(accessToken, m.id);
            const fullBody = extractEmailBody(r.data.payload);
            out.push({
                id: m.id,
                snippet: fullBody,
                internalDate: r.data.internalDate,
            });
        } catch (e) {
            // skip
        }
    }
    return out;
}

export async function markMessageAsRead(accessToken: string, messageId: string) {
    const url = `${GMAIL_API_BASE}/users/me/messages/${messageId}/modify`;
    await axios.post(url, { removeLabelIds: ["UNREAD"] }, { headers: { Authorization: `Bearer ${accessToken}` } });
}
