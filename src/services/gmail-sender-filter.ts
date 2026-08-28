import { prisma } from "../lib/prisma";

export const DEFAULT_FINANCIAL_DOMAINS = [
    "cdslindia.co.in",
    "nsdl.co.in",
    "camsonline.com",
    "kfintech.com"
];

export const DEFAULT_FINANCIAL_SENDERS = [
    "services@cdslindia.co.in",
    "alerts@nsdl.co.in",
    "donotreply@camsonline.com",
    "enq_k@kfintech.com"
];

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
    const configured = rows.map((row: { email: string }) => normalizeSenderEmail(row.email)).filter(Boolean);
    
    // Combine configured senders with default financial senders
    return Array.from(new Set([...configured, ...DEFAULT_FINANCIAL_SENDERS]));
}

export async function isApprovedFinancialSender(fromHeader?: string | null, configuredSenders?: string[]) {
    const sender = extractSenderEmailAddress(fromHeader);
    if (!sender) return false;

    // Check if domain is in default financial domains (e.g. @cdslindia.co.in)
    if (DEFAULT_FINANCIAL_DOMAINS.some(domain => sender.endsWith(`@${domain}`) || sender.includes(domain))) {
        return true;
    }

    const allowed = configuredSenders ?? await getConfiguredFinancialSenders();
    return Boolean(allowed.includes(sender));
}
