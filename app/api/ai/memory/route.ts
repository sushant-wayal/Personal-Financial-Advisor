import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getConversationExpiryInfo, saveOrUpdateConversation } from "../../../../src/services/aiConversation";

export async function GET() {
    try {
        const mem = await prisma.aIMemory.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
        const enriched = mem.map((item) => {
            const expiryInfo = getConversationExpiryInfo(item.expiresAt);
            return {
                ...item,
                isExpired: expiryInfo.isExpired,
                expiresInDays: expiryInfo.expiresInDays,
                expiryLabel: expiryInfo.label,
            };
        });
        return NextResponse.json({ ok: true, memories: enriched });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const key = body.key || (body.conversationId ? `chat:${body.conversationId}` : "");
        const rawResponse = body.response;
        const rawValue = typeof body.value === "string" ? body.value : (body.value ? JSON.stringify(body.value) : "");
        const value = rawValue || (typeof rawResponse === "string" ? rawResponse : (rawResponse ? JSON.stringify(rawResponse) : ""));

        if (!key && !body.conversationId) {
            return NextResponse.json({ error: "missing key or conversationId" }, { status: 400 });
        }
        if (!value && !body.question) {
            return NextResponse.json({ error: "missing value or question" }, { status: 400 });
        }

        const tagsArray: string[] = Array.isArray(body.tags)
            ? body.tags
            : (typeof body.tags === "string" ? JSON.parse(body.tags) : []);

        const isChat = key.startsWith("chat:") || Boolean(body.conversationId) || tagsArray.includes("chat");

        if (isChat) {
            const conversationId = body.conversationId || key.replace(/^chat:/, "");
            const result = await saveOrUpdateConversation({
                conversationId,
                question: body.question,
                response: body.response !== undefined ? body.response : value,
                value: body.value,
                name: body.name,
                expiresAt: body.expiresAt,
                tags: tagsArray,
            });

            const expiryInfo = getConversationExpiryInfo(result.conversation.expiresAt);
            return NextResponse.json({
                ok: true,
                memory: {
                    ...result.conversation,
                    isExpired: expiryInfo.isExpired,
                    expiresInDays: expiryInfo.expiresInDays,
                    expiryLabel: expiryInfo.label,
                },
                isNew: result.isNew,
                reason: result.reason,
            });
        }

        // Generic non-chat memory
        const created = await prisma.aIMemory.create({
            data: {
                key,
                value,
                name: body.name || null,
                expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                tags: JSON.stringify(tagsArray),
            },
        });

        const expiryInfo = getConversationExpiryInfo(created.expiresAt);
        return NextResponse.json({
            ok: true,
            memory: {
                ...created,
                isExpired: expiryInfo.isExpired,
                expiresInDays: expiryInfo.expiresInDays,
                expiryLabel: expiryInfo.label,
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        if (!body.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

        const dataToUpdate: {
            name?: string | null;
            expiresAt?: Date | null;
            value?: string;
            tags?: string;
        } = {};

        if (body.name !== undefined) {
            dataToUpdate.name = body.name ? String(body.name).trim().slice(0, 50) : null;
        }
        if (body.expiresAt !== undefined) {
            dataToUpdate.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        }
        if (body.value !== undefined) {
            dataToUpdate.value = String(body.value);
        }
        if (body.tags !== undefined) {
            dataToUpdate.tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : String(body.tags);
        }

        const updated = await prisma.aIMemory.update({
            where: { id: body.id },
            data: dataToUpdate,
        });

        const expiryInfo = getConversationExpiryInfo(updated.expiresAt);
        return NextResponse.json({
            ok: true,
            memory: {
                ...updated,
                isExpired: expiryInfo.isExpired,
                expiresInDays: expiryInfo.expiresInDays,
                expiryLabel: expiryInfo.label,
            },
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id") || undefined;
        if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
        await prisma.aIMemory.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
