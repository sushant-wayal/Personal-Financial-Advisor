import { NextResponse } from "next/server";
import { getStoredTokens, refreshAccessToken, fetchUnreadFinancialEmails, storeTokens, markMessageAsRead } from "../../../../src/services/gmail";
import { prisma } from "../../../../src/lib/prisma";
import axios from "axios";

export async function POST() {
    const tokens = await getStoredTokens();
    if (!tokens) return NextResponse.json({ error: "no tokens" }, { status: 400 });

    let accessToken = tokens.access_token;

    // get last sync date from AIMemory
    const lastMem = await prisma.aIMemory.findFirst({ where: { key: "gmail_last_synced" } });
    const afterDate = lastMem ? new Date(lastMem.value).toISOString() : undefined;

    try {
        let messages = await fetchUnreadFinancialEmails(accessToken, 50, afterDate);
        // if token expired, try refresh
        if ((!messages || messages.length === 0) && tokens.refresh_token) {
            try {
                const refreshed = await refreshAccessToken(tokens.refresh_token);
                await storeTokens({ ...tokens, ...refreshed });
                accessToken = refreshed.access_token || accessToken;
                messages = await fetchUnreadFinancialEmails(accessToken, 50, afterDate);
            } catch (err) {
                // continue with what we have
            }
        }

        const out: any[] = [];
        let newestDate = lastMem ? new Date(lastMem.value) : new Date(0);
        for (const m of messages || []) {
            try {
                const res = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/transactions`, { raw: m.snippet });
                out.push(res.data);
                // mark read
                try { await markMessageAsRead(accessToken, m.id); } catch (e) { }
                if (m.internalDate) {
                    const dt = new Date(Number(m.internalDate));
                    if (dt > newestDate) newestDate = dt;
                }
            } catch (e) {
                out.push({ error: String(e) });
            }
        }

        // store newest sync timestamp
        if (newestDate && newestDate.getTime() > 0) {
            const key = "gmail_last_synced";
            const mem = await prisma.aIMemory.findFirst({ where: { key } });
            if (mem) await prisma.aIMemory.update({ where: { id: mem.id }, data: { value: newestDate.toISOString() } });
            else await prisma.aIMemory.create({ data: { key, value: newestDate.toISOString(), tags: JSON.stringify(["gmail"]) } });
        }

        return NextResponse.json({ ok: true, results: out });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
