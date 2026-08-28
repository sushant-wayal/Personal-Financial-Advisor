import { describe, it, expect } from "vitest";
import { parseDepositoryEmail, isDepositorySender } from "./depository-parser";

describe("depository-parser", () => {
    it("should recognize CDSL and NSDL senders", () => {
        expect(isDepositorySender("services@cdslindia.co.in")).toBe(true);
        expect(isDepositorySender('"CDSL Alerts" <services@cdslindia.co.in>')).toBe(true);
        expect(isDepositorySender("alerts@nsdl.co.in")).toBe(true);
        expect(isDepositorySender("alerts@hdfcbank.net")).toBe(false);
    });

    it("should parse the exact user CDSL mutual fund email body correctly", () => {
        const emailBody = `Dear MR. SUSHANT SUNDAR WAYAL,
Following is/are the list of transactions for your Demat account ending with *91842623
Sr. No.
Company Name
ISIN
Quantity
Debit / Credit
Date and Time
1
UTI AMC LTD#UTI MF-UTI NIFTY NEXT 50 INDEX FUND-DIRECT-GROWTH
INF789FC12T1
90.507
Credit
28/08/2026 18:22:46
2
NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIAGOLD SAVINGS FUND DIRECT PLAN GROWTH
INF204K01YC4
22.177
Credit
28/08/2026 18:22:38
3
HDFC AMC LTD#HDFC MF-HDFC NIFTY MIDCAP 150 INDEX FUND-DIRECT-GROWTH
INF179KC1GC8
124.526
Credit
28/08/2026 18:22:24
4
UTI AMC LTD # UTI MF-UTI NIFTY 50 INDEX FUND DIRECT PLAN GROWTH
INF789F01XA0
44.241
Credit
28/08/2026 18:23:05
For further queries, please contact your Depository Participant [DP] with whom you hold your demat account.Yours Truly,
Central Depository Services (India) Ltd`;

        const result = parseDepositoryEmail(emailBody);

        expect(result.isDepositoryAlert).toBe(true);
        expect(result.dematAccount).toBe("*91842623");
        expect(result.items).toHaveLength(4);

        // Item 1: UTI Nifty Next 50
        expect(result.items[0].isin).toBe("INF789FC12T1");
        expect(result.items[0].quantity).toBe(90.507);
        expect(result.items[0].type).toBe("BUY");
        expect(result.items[0].assetType).toBe("MUTUAL_FUND");
        expect(result.items[0].companyName).toContain("UTI NIFTY NEXT 50");

        // Item 2: Nippon Gold
        expect(result.items[1].isin).toBe("INF204K01YC4");
        expect(result.items[1].quantity).toBe(22.177);
        expect(result.items[1].type).toBe("BUY");
        expect(result.items[1].assetType).toBe("MUTUAL_FUND");
        expect(result.items[1].companyName).toContain("NIPPON INDIAGOLD");

        // Item 3: HDFC Midcap 150
        expect(result.items[2].isin).toBe("INF179KC1GC8");
        expect(result.items[2].quantity).toBe(124.526);
        expect(result.items[2].type).toBe("BUY");
        expect(result.items[2].assetType).toBe("MUTUAL_FUND");
        expect(result.items[2].companyName).toContain("HDFC NIFTY MIDCAP 150");

        // Item 4: UTI Nifty 50
        expect(result.items[3].isin).toBe("INF789F01XA0");
        expect(result.items[3].quantity).toBe(44.241);
        expect(result.items[3].type).toBe("BUY");
        expect(result.items[3].assetType).toBe("MUTUAL_FUND");
        expect(result.items[3].companyName).toContain("UTI NIFTY 50");
    });
});
