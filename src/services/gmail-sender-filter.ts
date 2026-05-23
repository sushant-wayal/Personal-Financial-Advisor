import { prisma } from "../lib/prisma";

export function normalizeSenderEmail(email: string) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

export function extractSenderEmailAddress(fromHeader?: string | null) {
    if (!fromHeader) return "";
    const trimmed = String(fromHeader).trim();
    const angleMatch = trimmed.match(/<([^>]+)>/);
    const address = angleMatch?.[1] || trimmed;
    const emailMatch = address.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return normalizeSenderEmail(emailMatch?.[0] || address.replace(/^"|"$/g, ""));
}

export async function getConfiguredFinancialSenders() {
    const senderModel = (prisma as any).gmailSender;
    if (!senderModel) {
        throw new Error("gmail sender model not available");
    }

    const rows = await senderModel.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((row: { email: string }) => normalizeSenderEmail(row.email)).filter(Boolean);
}

export async function isApprovedFinancialSender(fromHeader?: string | null, configuredSenders?: string[]) {
    const allowed = configuredSenders ?? await getConfiguredFinancialSenders();
    const sender = extractSenderEmailAddress(fromHeader);
    return Boolean(sender && allowed.includes(sender));
}
