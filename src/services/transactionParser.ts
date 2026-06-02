import merchantDict from "../data/merchantDictionary.json";
import { TransactionRecord } from "../types/transaction";

type ParseResult = TransactionRecord & { confidence: number };

const amountRegexes = [
    /(?:Rs\.?|INR|₹)\s*(-?\s?[0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:amount|amt)\s*(?:of)?\s*(?:Rs\.?|INR|₹)?\s*(-?\s?[0-9,]+(?:\.[0-9]{1,2})?)/i,
];

const bankPatterns: Array<[RegExp, string]> = [
    [/\bhdfc(?:\s+bank)?\b/i, "HDFC"],
    [/\bicici(?:\s+bank)?\b/i, "ICICI"],
    [/\baxis(?:\s+bank)?\b/i, "Axis"],
    [/\bsbi\b|\bstate bank of india\b/i, "SBI"],
    [/\bkotak(?:\s+mahindra)?(?:\s+bank)?\b/i, "Kotak"],
    [/\byes(?:\s+bank)?\b/i, "Yes Bank"],
    [/\bindusind(?:\s+bank)?\b/i, "IndusInd"],
];

const providerWords = new Set([
    "paytm",
    "phonepe",
    "gpay",
    "google pay",
    "googlepay",
    "bharatpe",
    "amazon pay",
]);

const monthNumbers: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
};

const merchantAcronyms = new Set(["upi", "vpa", "atm", "lic", "pvr", "inox"]);

const noiseWords = new Set([
    "dear",
    "customer",
    "greetings",
    "from",
    "bank",
    "upi",
    "vpa",
    "txn",
    "transaction",
    "ref",
    "utr",
    "account",
    "acct",
    "available",
    "balance",
    "debit",
    "debited",
    "credit",
    "credited",
    "successful",
    "successfully",
    "payment",
    "paid",
    "sent",
    "received",
    "towards",
    "ending",
    "your",
    "a/c",
    "rs",
    "inr",
]);

function normalizeText(s: string) {
    return s.replace(/&(?:#39|apos);/gi, "'").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function keyFor(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function titleCase(value: string) {
    return value
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => merchantAcronyms.has(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function isInfrastructureName(value: string) {
    const normalized = keyFor(value);
    if (!normalized) return true;
    if (providerWords.has(normalized)) return true;
    if (bankPatterns.some(([pattern]) => pattern.test(normalized))) return true;

    const words = normalized.split(" ");
    return words.every((word) => noiseWords.has(word) || /^\d+$/.test(word));
}

function cleanMerchantCandidate(
    candidate: string,
    options?: {
        preserveUpi?: boolean;
        structuredField?: boolean;
    }
) {
    let value = normalizeText(candidate);

    if (!options?.structuredField) {
        value = value
            .replace(/\b(?:on|dated?|at)\s+\d{1,2}[\s\-/]\d{1,2}[\s\-/]\d{2,4}.*$/i, "")
            .replace(/\b(?:ref|txn|transaction|utr|rrn|available balance|avl bal|if not done by you)\b.*$/i, "")
            .replace(/\b(?:via|using|through|by)\s+(?:upi|vpa|card|netbanking|net banking|paytm|phonepe|gpay|google pay)\b.*$/i, "")
            .replace(/\b(?:from|to)?\s*(?:vpa|upi id)\s+[a-z0-9._-]+@[a-z0-9._-]+\b/ig, " ")
            .replace(/\b[a-z0-9._-]+@[a-z0-9._-]+\b/ig, " ");
    }

    value = value
        .replace(/[^A-Za-z0-9&.'/ -]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    value = value
        .split(/\s+/)
        .filter((word) => {
            const lower = word.toLowerCase();

            if (options?.preserveUpi && lower === "upi") {
                return true;
            }

            if (options?.structuredField) {
                return true;
            }

            return !noiseWords.has(lower);
        })
        .join(" ")
        .trim();

    if (!value) return undefined;

    if (!options?.structuredField && isInfrastructureName(value)) {
        return undefined;
    }

    return titleCase(value);
}

function merchantFromStructuredDetails(text: string) {
    console.log("Attempting structured merchant extraction from:", text);
    const labels = [
        "Sender",
        "Merchant",
        "Receiver",
        "Payee",
        "Beneficiary",
    ];

    for (const label of labels) {
        const startRegex = new RegExp(`${label}\\s*:`, "i");
        const startMatch = startRegex.exec(text);

        if (!startMatch || startMatch.index === undefined) {
            continue;
        }

        const startIndex = startMatch.index + startMatch[0].length;

        const remaining = text.slice(startIndex);

        let endIndex = remaining.length;

        const vpaIndex = remaining.search(/\(\s*VPA\s*:/i);
        if (vpaIndex !== -1) {
            endIndex = Math.min(endIndex, vpaIndex);
        }

        const refIndex = remaining.search(/\bUPI\s+Reference\b/i);
        if (refIndex !== -1) {
            endIndex = Math.min(endIndex, refIndex);
        }

        const rawMerchant = remaining
            .slice(0, endIndex)
            .replace(/\s+/g, " ")
            .trim();

        if (!rawMerchant) {
            continue;
        }

        const cleaned = cleanMerchantCandidate(rawMerchant, {
            preserveUpi: true,
            structuredField: true,
        });

        if (cleaned) {
            return cleaned;
        }
    }

    return undefined;
}

function extractMerchant(text: string, rawText?: string) {
    const structuredMerchant = merchantFromStructuredDetails(rawText ?? text);

    if (structuredMerchant) {
        return {
            merchant: structuredMerchant,
            confidence: 0.9,
        };
    }

    const directPatterns = [
        /\b(?:paid|sent|payment made|payment|debited|credited)\s+(?:to|from|at)\s+([A-Za-z0-9&.' -]{2,80}?)(?=\s+\b(?:via|using|through|on|ref|txn|utr|rrn|for|from account|to account)\b|$)/i,

        /\bat\s+([A-Za-z0-9&.' -]{2,80}?)(?=\s+\b(?:on|via|using|through|ref|txn|utr|rrn)\b|$)/i,
    ];

    for (const pattern of directPatterns) {
        const match = text.match(pattern);

        const cleaned = match?.[1]
            ? cleanMerchantCandidate(match[1])
            : undefined;

        if (cleaned) {
            return {
                merchant: cleaned,
                confidence: 0.78,
            };
        }
    }

    const vpaMerchant = merchantFromVpaContext(text);

    if (vpaMerchant) {
        return {
            merchant: vpaMerchant,
            confidence: 0.7,
        };
    }

    const dictMerchant = merchantFromDictionary(text);

    if (dictMerchant) {
        return {
            merchant: dictMerchant,
            confidence: 0.82,
        };
    }

    return {
        merchant: "Unknown",
        confidence: 0.35,
    };
}

function extractAmount(text: string) {
    for (const regex of amountRegexes) {
        const match = text.match(regex);
        if (!match?.[1]) continue;
        const parsed = parseFloat(match[1].replace(/[,\s]/g, "").replace(/\-\s*/, "-"));
        if (!Number.isNaN(parsed)) return Math.abs(parsed);
    }
    return 0;
}

function extractBankName(text: string) {
    const match = bankPatterns.find(([pattern]) => pattern.test(text));
    return match?.[1];
}

function extractPaymentMethod(text: string) {
    if (/\bupi\b|\bvpa\b|@[a-z0-9._-]+\b/i.test(text)) return "UPI";
    if (/\b(?:credit|debit)\s+card\b|\bcard\b/i.test(text)) return "Card";
    if (/\bimps\b/i.test(text)) return "IMPS";
    if (/\bneft\b/i.test(text)) return "NEFT";
    if (/\brtgs\b/i.test(text)) return "RTGS";
    if (/\bnet\s*banking\b/i.test(text)) return "Net Banking";
    return undefined;
}

function parseDateParts(day: number, month: number, year: number, hour = 0, minute = 0, second = 0) {
    const fullYear = year < 100 ? 2000 + year : year;
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    const parsed = new Date(fullYear, month - 1, day, hour, minute, second);
    if (parsed.getFullYear() !== fullYear || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return undefined;
    return parsed;
}

function timeParts(match: RegExpMatchArray, startIndex: number) {
    return {
        hour: match[startIndex] ? Number(match[startIndex]) : 0,
        minute: match[startIndex + 1] ? Number(match[startIndex + 1]) : 0,
        second: match[startIndex + 2] ? Number(match[startIndex + 2]) : 0,
    };
}

function extractTimestamp(text: string) {
    const numeric = text.match(/\b(\d{1,2})[\s\-/](\d{1,2})[\s\-/](\d{2,4})\b/);
    if (numeric) {
        const first = Number(numeric[1]);
        const second = Number(numeric[2]);
        const year = Number(numeric[3]);
        const ddmmyyyy = parseDateParts(first, second, year);
        if (ddmmyyyy) return ddmmyyyy;
        const mmddyyyy = parseDateParts(second, first, year);
        if (mmddyyyy) return mmddyyyy;
    }

    const dayMonthName = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{2,4})(?:\s+(?:at|on)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?\b/i);
    if (dayMonthName) {
        const month = monthNumbers[dayMonthName[2].toLowerCase()];
        const { hour, minute, second } = timeParts(dayMonthName, 4);
        const parsed = month ? parseDateParts(Number(dayMonthName[1]), month, Number(dayMonthName[3]), hour, minute, second) : undefined;
        if (parsed) return parsed;
    }

    const monthNameDay = text.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})(?:\s+(?:at|on)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?)?\b/i);
    if (monthNameDay) {
        const month = monthNumbers[monthNameDay[1].toLowerCase()];
        const { hour, minute, second } = timeParts(monthNameDay, 4);
        const parsed = month ? parseDateParts(Number(monthNameDay[2]), month, Number(monthNameDay[3]), hour, minute, second) : undefined;
        if (parsed) return parsed;
    }

    const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (iso) return parseDateParts(Number(iso[3]), Number(iso[2]), Number(iso[1]));

    return undefined;
}

function extractTransactionType(text: string): ParseResult["transactionType"] {
    const lc = text.toLowerCase();
    if (/\bsalary\b/.test(lc)) return "SALARY";
    if (/\brefund|cashback\b/.test(lc)) return "REFUND";
    if (/\bcredited|credit(?:ed)? to your account|received\b/.test(lc)) return "CREDIT";
    if (/\btransfer(?:red)?\b/.test(lc)) return "TRANSFER";
    if (/\bdebited|debit|paid|payment|sent\b/.test(lc)) return "DEBIT";
    return "OTHER";
}

function merchantFromDictionary(text: string) {
    const normalizedText = keyFor(text);
    const textTokens = new Set(normalizedText.split(" ").filter(Boolean));
    for (const [key, entry] of Object.entries(merchantDict as Record<string, { merchant: string; category: string }>)) {
        const normalizedKey = keyFor(key);
        if (!normalizedKey || providerWords.has(normalizedKey)) continue;

        const isShortToken = !normalizedKey.includes(" ") && normalizedKey.length <= 3;
        if (isShortToken ? textTokens.has(normalizedKey) : ` ${normalizedText} `.includes(` ${normalizedKey} `)) {
            return entry.merchant;
        }
    }
    return undefined;
}

function merchantFromVpaContext(text: string) {
    const patterns = [
        /\b(?:to|towards|by|from)\s+vpa\s+[a-z0-9._-]+@[a-z0-9._-]+\s*\(([^)]{2,80})\)/i,
        /\b(?:to|towards|by|from)\s+vpa\s+[a-z0-9._-]+@[a-z0-9._-]+\s+([A-Za-z][A-Za-z0-9&.' -]{2,60}?)(?=\s+\b(?:on|ref|txn|utr|rrn|if not done|available balance)\b|$)/i,
        /\b(?:to|towards|by|from)\s+([A-Za-z][A-Za-z0-9&.' -]{2,60}?)\s+(?:via|through|using)\s+(?:upi|vpa)\b/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const cleaned = match?.[1] ? cleanMerchantCandidate(match[1]) : undefined;
        if (cleaned) return cleaned;
    }
    return undefined;
}

export function deterministicParse(raw: string): ParseResult {
    console.log("Parsing transaction text:", raw);
    const text = normalizeText(raw);
    const amount = extractAmount(text);
    const timestamp = extractTimestamp(text);
    const transactionType = extractTransactionType(text);
    const paymentMethod = extractPaymentMethod(text);
    const bankName = extractBankName(text);
    const merchantResult = extractMerchant(text, raw);

    let confidence = merchantResult.confidence;
    if (amount > 0) confidence += 0.08;
    if (timestamp) confidence += 0.08;
    if (paymentMethod) confidence += 0.03;
    if (bankName) confidence += 0.02;
    if (transactionType !== "OTHER") confidence += 0.04;
    confidence = Math.min(1, confidence);

    return {
        amount,
        merchant: merchantResult.merchant,
        timestamp,
        source: "email",
        account: undefined,
        paymentMethod,
        bankName,
        transactionType,
        type: transactionType,
        notes: undefined,
        confidence,
        rawText: raw,
        raw,
    } as ParseResult;
}

export const transactionParserUtils = {
    cleanMerchantCandidate,
    extractTimestamp,
    keyFor,
};
