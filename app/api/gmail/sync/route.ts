import { NextResponse } from "next/server";
import { withGmailAuth, fetchUnreadFinancialEmails } from "../../../../src/services/gmail";
import { prisma } from "../../../../src/lib/prisma";
import axios from "axios";

export async function POST() {
    try {
        return await withGmailAuth(async (accessToken) => {
            const senderModel = (prisma as any).gmailSender;
            if (!senderModel) {
                console.error("[gmail-sync] Prisma client missing GmailSender model. Regenerate client and restart server.");
                return NextResponse.json({ error: "gmail sender model not available" }, { status: 500 });
            }

            const senderRows = await senderModel.findMany({ orderBy: { createdAt: "asc" } });
            const senders = senderRows.map((row: { email: string }) => row.email).filter(Boolean);
            if (!senders.length) {
                return NextResponse.json({ error: "no sender emails configured" }, { status: 400 });
            }

            // get last sync date from AIMemory
            const lastMem = await prisma.aIMemory.findFirst({ where: { key: "gmail_last_synced" } });
            const afterDate = lastMem ? new Date(lastMem.value).toISOString() : undefined;

            const messages = await fetchUnreadFinancialEmails(accessToken, senders, 50, afterDate);

            const out: any[] = [];
            let newestDate = lastMem ? new Date(lastMem.value) : new Date(0);
            for (const m of messages || []) {
                try {
                    const res = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/transactions`, { raw: m.snippet });
                    out.push(res.data);
                    if (m.internalDate) {
                        const dt = new Date(Number(m.internalDate));
                        if (dt > newestDate) newestDate = dt;
                    }
                } catch (e: any) {
                    const status = e?.response?.status;
                    const data = e?.response?.data;
                    console.error("[gmail-sync] transaction ingestion failed", { status, data });
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
        });
    } catch (e: any) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        console.error("[gmail-sync] auth wrapper failed", { status, data });
        return NextResponse.json({ error: "Authentication failed", details: data }, { status: status || 500 });
    }
}
