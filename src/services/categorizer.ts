import { prisma } from "../lib/prisma";
import merchantDict from "../data/merchantDictionary.json";
import { generateText } from "./gemini";
import { transactionParserUtils } from "./transactionParser";

const INVALID_CATEGORIES = new Set(["bank", "transfer", "upi", "vpa", "paytm", "phonepe", "google pay", "gpay", "hdfc", "icici"]);

export const SPENDING_CATEGORIES = [
    "Food",
    "Groceries",
    "Shopping",
    "Transport",
    "Bills",
    "Rent",
    "Healthcare",
    "Education",
    "Entertainment",
    "Subscription",
    "Travel",
    "Investment",
    "Insurance",
    "Salary",
    "Refund",
    "Miscellaneous",
] as const;

type SpendingCategory = typeof SPENDING_CATEGORIES[number];

type CategoryResult = {
    category: SpendingCategory;
    confidence: number;
    source: "learned" | "dictionary" | "heuristic" | "ai" | "fallback";
};

function normalizeCategory(category?: string): SpendingCategory | undefined {
    if (!category) return undefined;
    const trimmed = category.trim();
    if (!trimmed || INVALID_CATEGORIES.has(trimmed.toLowerCase())) return undefined;
    const match = SPENDING_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    return match;
}

function merchantKey(merchant: string) {
    return transactionParserUtils.keyFor(merchant);
}

function dictionaryCategory(merchant: string): CategoryResult | undefined {
    const key = merchantKey(merchant);
    if (!key || key === "unknown") return undefined;

    for (const [dictKey, entry] of Object.entries(merchantDict as Record<string, { merchant: string; category: string }>)) {
        const normalizedDictKey = merchantKey(dictKey);
        const normalizedMerchant = merchantKey(entry.merchant);
        if (key === normalizedDictKey || key === normalizedMerchant || key.includes(normalizedDictKey) || normalizedDictKey.includes(key)) {
            const category = normalizeCategory(entry.category);
            if (category) return { category, confidence: 0.9, source: "dictionary" };
        }
    }

    return undefined;
}

function heuristicCategory(merchant: string, rawText?: string, transactionType?: string): CategoryResult | undefined {
    const text = `${merchant} ${rawText ?? ""}`.toLowerCase();
    if (transactionType === "SALARY" || /\bsalary\b/.test(text)) return { category: "Salary", confidence: 0.92, source: "heuristic" };
    if (transactionType === "REFUND" || /\brefund|cashback\b/.test(text)) return { category: "Refund", confidence: 0.82, source: "heuristic" };
    if ((transactionType === "CREDIT" || /\bcredited\b/.test(text)) && /\bweb\s+upi\b/.test(text)) return { category: "Refund", confidence: 0.74, source: "heuristic" };
    if (/\bwater\s+park|amusement|theme\s+park|cinema|movie|pvr|inox|bowling|game\s+zone\b/.test(text)) return { category: "Entertainment", confidence: 0.78, source: "heuristic" };
    if (/\bpaytm\s+travel|travel|uber|ola|rapido|metro|irctc|fuel|petrol|diesel|cab|taxi|flight|bus|railway|train\b/.test(text)) return { category: "Transport", confidence: 0.74, source: "heuristic" };
    if (/\bzomato|swiggy|restaurant|cafe|pizza|burger|dominos|mcdonald|starbucks|foods?|farsan|sweets?|bakery|bakers?|dairy|snacks?|juice|tea\b/.test(text)) return { category: "Food", confidence: 0.75, source: "heuristic" };
    if (/\bblinkit|zepto|bigbasket|dmart|grocery|groceries|mart|super\s*market|supermarket|daily needs|traders?|general stores?|kirana|provision|departmental store\b/.test(text)) return { category: "Groceries", confidence: 0.72, source: "heuristic" };
    if (/\b(?:airtel|jio|vi|vodafone|electricity|water\s*bill|gas\s*bill|broadband|wifi|utility)\b/.test(text)) return { category: "Bills", confidence: 0.72, source: "heuristic" };
    if (/\bnetflix|spotify|hotstar|prime video|youtube premium|subscription\b/.test(text)) return { category: "Subscription", confidence: 0.76, source: "heuristic" };
    if (/\bamazon|flipkart|myntra|ajio|nykaa|shopping\b/.test(text)) return { category: "Shopping", confidence: 0.72, source: "heuristic" };
    if (/\bgroww|zerodha|mutual fund|sip|nps|stock|demat\b/.test(text)) return { category: "Investment", confidence: 0.78, source: "heuristic" };
    if (/\blic|insurance|policy premium|premium\b/.test(text)) return { category: "Insurance", confidence: 0.75, source: "heuristic" };
    if (/\bhospital|clinic|pharmacy|apollo|medicine|doctor\b/.test(text)) return { category: "Healthcare", confidence: 0.72, source: "heuristic" };
    return undefined;
}

async function aiFallbackCategory(merchant: string, rawText?: string): Promise<CategoryResult | undefined> {
    if (!process.env.GEMINI_API_KEY || !merchant || merchantKey(merchant) === "unknown") return undefined;

    const prompt = [
        "Classify this personal finance transaction into exactly one category.",
        `Allowed categories: ${SPENDING_CATEGORIES.join(", ")}.`,
        "Never return Bank, Transfer, UPI, VPA, Paytm, PhonePe, Google Pay, HDFC, ICICI, or any payment rail/provider as a category.",
        "Return only the category name and nothing else.",
        `Merchant: ${merchant}`,
        `Raw transaction text: ${rawText ?? ""}`,
    ].join("\n");

    try {
        const response = await generateText(prompt, { temperature: 0, maxTokens: 8, complexity: "simple" });
        const cleaned = response.text.replace(/[^A-Za-z ]/g, "").trim();
        const category = normalizeCategory(cleaned);
        return category ? { category, confidence: 0.58, source: "ai" } : undefined;
    } catch {
        return undefined;
    }
}

async function findLearnedCategory(merchant: string) {
    const key = merchantKey(merchant);
    if (!key || key === "unknown") return undefined;

    const rows = await prisma.$queryRaw<Array<{ category: string; confidence: number }>>`
        SELECT c.name as category, m.confidence as confidence
        FROM MerchantCategoryMap m
        JOIN Category c ON c.id = m.categoryId
        WHERE m.merchantKey = ${key}
        LIMIT 1
    `;
    const row = rows[0];
    const category = normalizeCategory(row?.category);
    return category ? { category, confidence: row.confidence ?? 0.95 } : undefined;
}

export async function findOrCreateCategory(name: string) {
    const category = normalizeCategory(name) ?? "Miscellaneous";
    return prisma.category.upsert({
        where: { name: category },
        update: {},
        create: { name: category },
    });
}

export async function autoCategorize(merchant: string, options?: { rawText?: string; transactionType?: string; fallback?: string }): Promise<CategoryResult> {
    const learned = await findLearnedCategory(merchant);
    if (learned) return { category: learned.category, confidence: learned.confidence, source: "learned" };

    const dict = dictionaryCategory(merchant);
    if (dict) return dict;

    const heuristic = heuristicCategory(merchant, options?.rawText, options?.transactionType);
    if (heuristic) return heuristic;

    const ai = await aiFallbackCategory(merchant, options?.rawText);
    if (ai) return ai;

    const fallback = normalizeCategory(options?.fallback);
    return { category: fallback ?? "Miscellaneous", confidence: fallback ? 0.45 : 0.35, source: "fallback" };
}

export async function teachMerchantCategory(merchant: string, categoryName: string) {
    const key = merchantKey(merchant);
    if (!key || key === "unknown") return null;

    const category = await findOrCreateCategory(categoryName);
    await prisma.$executeRaw`
        INSERT INTO MerchantCategoryMap (id, merchantKey, merchantName, categoryId, confidence, source, createdAt, updatedAt)
        VALUES (${`merchant_map_${key.replace(/[^a-z0-9]+/g, "_")}`}, ${key}, ${merchant}, ${category.id}, ${0.98}, ${"manual"}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(merchantKey) DO UPDATE SET
            merchantName = excluded.merchantName,
            categoryId = excluded.categoryId,
            confidence = excluded.confidence,
            source = excluded.source,
            updatedAt = CURRENT_TIMESTAMP
    `;
    return { merchantKey: key, merchantName: merchant, category };
}

export function isValidSpendingCategory(category?: string) {
    return Boolean(normalizeCategory(category));
}
