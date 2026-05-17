import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

function normalizeSenders(input: string[]) {
    const cleaned = input
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(cleaned));
}

export async function GET() {
    const senderModel = (prisma as any).gmailSender;
    if (!senderModel) {
        return NextResponse.json({ error: "gmail sender model not available" }, { status: 500 });
    }
    const rows = await senderModel.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json({ senders: rows.map((row: { email: string }) => row.email) });
}

export async function PUT(req: Request) {
    const body = await req.json().catch(() => ({}));
    const sendersRaw = Array.isArray(body?.senders)
        ? body.senders
        : typeof body?.senders === "string"
            ? body.senders.split(/,|\n/)
            : [];

    const senders = normalizeSenders(sendersRaw);

    const senderModel = (prisma as any).gmailSender;
    if (!senderModel) {
        return NextResponse.json({ error: "gmail sender model not available" }, { status: 500 });
    }

    await senderModel.deleteMany();
    if (senders.length) {
        const writes = senders.map((email) => senderModel.create({ data: { email } }));
        await prisma.$transaction(writes);
    }

    return NextResponse.json({ ok: true, senders });
}
