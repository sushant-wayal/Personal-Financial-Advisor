import merchantDict from "../data/merchantDictionary.json";
import { TransactionRecord } from "../types/transaction";

type ParseResult = TransactionRecord & { confidence: number };

const amountRegex = /(?:Rs\.?|INR\s?|₹)\s?(-?\s?[0-9,]+(?:\.[0-9]{1,2})?)/i;
const dateRegex = /([0-9]{1,2}[\-/][0-9]{1,2}[\-/][0-9]{2,4})|([A-Za-z]{3,9}\s[0-9]{1,2},?\s[0-9]{4})/;
const upiRegex = /(upi|vpa|@okaxis|@ybl|@apl)/i;
const bankSmsKeywords = /(debited|credited|ref|txn|transaction|a\/c|acct|available balance)/i;

function normalizeText(s: string) {
    return s.replace(/\s+/g, " ").trim();
}

function detectMerchantByHeuristics(text: string) {
    const lc = text.toLowerCase();
    for (const key of Object.keys(merchantDict)) {
        if (lc.includes(key)) return (merchantDict as any)[key];
    }
    // attempt to pick FIRST capitalized token sequence as merchant from original text
    const capMatch = text.match(/([A-Z][A-Za-z0-9& ]{2,30})/);
    if (capMatch) return { merchant: capMatch[1].trim(), category: undefined };
    return null;
}

export function deterministicParse(raw: string): ParseResult {
    const text = normalizeText(raw);
    let amount = 0;
    let merchant = "Unknown";
    let category: string | undefined = undefined;
    let confidence = 0.4;

    // amount detection (try multiple strategies)
    const m = text.match(amountRegex);
    if (m && m[1]) {
        const cleaned = m[1].replace(/[,\s]/g, "").replace(/\-\s*/, "-");
        const num = parseFloat(cleaned);
        if (!isNaN(num)) {
            amount = Math.abs(num);
            // credit if negative sign present
            if (/\-/.test(m[1])) {
                confidence += 0.25;
            } else {
                confidence += 0.35;
            }
        }
    }

    // detect UPI/bank style
    if (upiRegex.test(text)) {
        confidence += 0.05;
        if (!category) category = "Transfer";
    }
    if (bankSmsKeywords.test(text)) {
        confidence += 0.05;
    }

    // detect credit/debit keywords
    if (/\b(credited|cr\b|refund|cashback)\b/i.test(text)) {
        confidence += 0.15;
        // credit
    }
    if (/\b(debited|dr\b|paid|payment)\b/i.test(text)) {
        confidence += 0.1;
        // debit
    }

    // merchant via dictionary or heuristics
    const dict = detectMerchantByHeuristics(raw);
    if (dict) {
        merchant = dict.merchant || merchant;
        if (dict.category) category = dict.category;
        confidence += 0.25;
    }

    // salary detection
    if (/salary|credited.*salary|salary credited/.test(text.toLowerCase())) {
        category = "Salary";
        confidence = Math.max(confidence, 0.95);
    }

    // UPI reference id heuristics
    const upiRef = raw.match(/(UPI|Ref|TXN|txn)[:\s]*([A-Za-z0-9\-_/]+)/i);
    if (upiRef) {
        confidence = Math.min(1, confidence + 0.05);
    }

    // refund detection
    if (/refund|credited.*refund/.test(text.toLowerCase())) {
        category = "Refund";
    }

    // date
    let timestamp: string | undefined = undefined;
    const d = raw.match(dateRegex);
    if (d) timestamp = d[0];

    // type: prefer DEBIT for typical amounts, but if text suggests credited or refund, mark CREDIT
    let type: ParseResult["type"] = "DEBIT";
    if (/credited|refund|credit/.test(text.toLowerCase())) type = "CREDIT";
    if (/salary/.test(text.toLowerCase())) type = "SALARY";

    // final confidence clamp
    confidence = Math.min(1, confidence);

    return {
        amount,
        merchant,
        category,
        timestamp,
        source: "email",
        account: undefined,
        type,
        notes: undefined,
        confidence,
        raw,
    } as ParseResult;
}
