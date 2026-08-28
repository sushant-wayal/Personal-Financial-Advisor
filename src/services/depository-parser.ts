/**
 * Depository Transaction Parser
 * Parses transaction alerts from CDSL (services@cdslindia.co.in) and NSDL
 */

export interface DepositoryTransactionItem {
    srNo?: number;
    companyName: string;
    isin: string;
    quantity: number;
    type: "BUY" | "SELL"; // Credit -> BUY, Debit -> SELL
    assetType: "MUTUAL_FUND" | "EQUITY" | "OTHER";
    timestamp?: Date;
    dematAccount?: string;
}

export interface DepositoryParseResult {
    isDepositoryAlert: boolean;
    dematAccount?: string;
    items: DepositoryTransactionItem[];
}

/**
 * Check if sender is CDSL or NSDL
 */
export function isDepositorySender(fromHeader?: string | null): boolean {
    if (!fromHeader) return false;
    const lower = fromHeader.toLowerCase();
    return (
        lower.includes("cdslindia") ||
        lower.includes("services@cdslindia.co.in") ||
        lower.includes("nsdl.co.in") ||
        lower.includes("nsdl")
    );
}

/**
 * Parse CDSL / NSDL email body text
 */
export function parseDepositoryEmail(content: string): DepositoryParseResult {
    if (!content) {
        return { isDepositoryAlert: false, items: [] };
    }

    const isCdslOrNsdl = /cdsl|central depository|nsdl|national securities depository|demat account/i.test(content);
    if (!isCdslOrNsdl && !/INF[A-Z0-9]{9}|INE[A-Z0-9]{9}/i.test(content)) {
        return { isDepositoryAlert: false, items: [] };
    }

    // Extract Demat account if available (e.g., "ending with *91842623" or "Demat account 12081600...")
    const dematMatch = content.match(/demat account[^\n\r]*?(\*?\d{4,16})/i);
    const dematAccount = dematMatch ? dematMatch[1] : undefined;

    const items: DepositoryTransactionItem[] = [];

    // 1. Regular expression to find ISIN occurrences and their surrounding context
    // ISIN format: 2 letters country code (IN) + 1 letter security type (F for Fund, E for Equity) + 9 alphanumeric
    const isinRegex = /\b(IN[A-Z0-9]{10})\b/gi;
    let match: RegExpExecArray | null;
    const isinMatches: { isin: string; index: number }[] = [];

    while ((match = isinRegex.exec(content)) !== null) {
        isinMatches.push({ isin: match[1].toUpperCase(), index: match.index });
    }

    if (isinMatches.length === 0) {
        return { isDepositoryAlert: isCdslOrNsdl, dematAccount, items: [] };
    }

    // Process each matched ISIN by extracting the relevant segment around it
    for (let i = 0; i < isinMatches.length; i++) {
        const current = isinMatches[i];
        const prevIndex = i === 0 ? 0 : isinMatches[i - 1].index + isinMatches[i - 1].isin.length;
        const nextIndex = i === isinMatches.length - 1 ? content.length : isinMatches[i + 1].index;

        // Context before ISIN (typically holds Sr No and Company Name)
        const beforeText = content.substring(prevIndex, current.index).trim();
        // Context after ISIN (typically holds Quantity, Debit/Credit, Date & Time)
        const afterText = content.substring(current.index + current.isin.length, nextIndex).trim();

        // 1. Determine Asset Type by ISIN prefix
        let assetType: "MUTUAL_FUND" | "EQUITY" | "OTHER" = "OTHER";
        if (current.isin.startsWith("INF")) {
            assetType = "MUTUAL_FUND";
        } else if (current.isin.startsWith("INE")) {
            assetType = "EQUITY";
        }

        // 2. Extract Company / Fund Name from beforeText
        // Split by lines or clean up
        const beforeLines = beforeText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
        
        let companyName = "";
        let srNo: number | undefined;

        if (beforeLines.length > 0) {
            // Find the last line before ISIN that is not a table header
            for (let j = beforeLines.length - 1; j >= 0; j--) {
                const line = beforeLines[j];
                if (/^(sr\.?\s*no\.?|company\s*name|isin|quantity|debit|credit|date)/i.test(line)) {
                    continue;
                }
                // Check if line is just a number (Sr. No.)
                if (/^\d+$/.test(line)) {
                    srNo = parseInt(line, 10);
                    continue;
                }
                if (!companyName && line.length > 2) {
                    companyName = line;
                }
            }
        }

        // If companyName was preceding the Sr. No line
        if (!companyName && beforeLines.length > 0) {
            companyName = beforeLines[beforeLines.length - 1];
        }

        // Clean company name
        companyName = companyName
            .replace(/^(\d+[\s\.\-]+)/, "") // remove leading "1.", "2 - "
            .trim();

        // 3. Extract Quantity, Credit/Debit, and Date from afterText
        const afterLines = afterText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        let quantity = 0;
        let type: "BUY" | "SELL" = "BUY";
        let timestamp: Date | undefined;

        for (const line of afterLines) {
            // Check for Credit / Debit
            if (/\bcredit\b/i.test(line)) {
                type = "BUY";
            } else if (/\bdebit\b/i.test(line)) {
                type = "SELL";
            }

            // Check for quantity (e.g. 90.507 or 124.526 or 100)
            const numMatch = line.match(/^([0-9]+(?:\.[0-9]+)?)$/);
            if (numMatch && quantity === 0) {
                const parsedQty = parseFloat(numMatch[1]);
                if (!isNaN(parsedQty) && parsedQty > 0) {
                    quantity = parsedQty;
                }
            }

            // Check for Date and Time (e.g., "28/08/2026 18:22:46" or "28-08-2026 18:22:46" or "2026-08-28")
            const dateMatch = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
            if (dateMatch && !timestamp) {
                const day = parseInt(dateMatch[1], 10);
                const month = parseInt(dateMatch[2], 10) - 1;
                const year = parseInt(dateMatch[3], 10);
                const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
                const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
                const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;

                const parsedDate = new Date(year, month, day, hours, minutes, seconds);
                if (!isNaN(parsedDate.getTime())) {
                    timestamp = parsedDate;
                }
            }
        }

        // Fallback for quantity if not on its own line
        if (quantity === 0) {
            const inlineQtyMatch = afterText.match(/\b([0-9]+(?:\.[0-9]+)?)\b/);
            if (inlineQtyMatch) {
                const q = parseFloat(inlineQtyMatch[1]);
                if (!isNaN(q) && q > 0) {
                    quantity = q;
                }
            }
        }

        // Fallback for Credit/Debit if not caught in lines
        if (/\bdebit\b/i.test(afterText)) {
            type = "SELL";
        } else if (/\bcredit\b/i.test(afterText)) {
            type = "BUY";
        }

        if (quantity > 0) {
            items.push({
                srNo,
                companyName: companyName || current.isin,
                isin: current.isin,
                quantity,
                type,
                assetType,
                timestamp,
                dematAccount
            });
        }
    }

    return {
        isDepositoryAlert: true,
        dematAccount,
        items
    };
}
