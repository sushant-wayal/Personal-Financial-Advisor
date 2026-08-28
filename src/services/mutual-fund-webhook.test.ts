import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ingestMutualFundDepositoryAlert } from "./mutual-fund-webhook.service";
import { prisma } from "../lib/prisma";

describe("Mutual Fund Depository Ingestion", () => {
    beforeEach(async () => {
        // Clean up test mutual funds
        await prisma.mutualFund.deleteMany({
            where: {
                isin: { in: ["INF789FC12T1", "INF204K01YC4", "INF179KC1GC8", "INF789F01XA0"] }
            }
        });
    });

    afterEach(async () => {
        // Clean up test mutual funds
        await prisma.mutualFund.deleteMany({
            where: {
                isin: { in: ["INF789FC12T1", "INF204K01YC4", "INF179KC1GC8", "INF789F01XA0"] }
            }
        });
    });

    it("should auto-create mutual funds from CDSL email body", async () => {
        const cdslEmailContent = `Dear MR. SUSHANT SUNDAR WAYAL,
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

        const res = await ingestMutualFundDepositoryAlert({
            messageId: "msg_test_cdsl_123",
            content: cdslEmailContent,
            timestamp: new Date()
        });

        expect(res.ok).toBe(true);
        expect(res.createdCount).toBe(4);
        expect(res.processedCount).toBe(4);

        // Verify DB records
        const funds = await prisma.mutualFund.findMany({
            where: {
                isin: { in: ["INF789FC12T1", "INF204K01YC4", "INF179KC1GC8", "INF789F01XA0"] }
            }
        });

        expect(funds).toHaveLength(4);

        const utiNext50 = funds.find(f => f.isin === "INF789FC12T1");
        expect(utiNext50).toBeDefined();
        expect(utiNext50?.currentUnits).toBe(90.507);
        expect(utiNext50?.planType).toBe("DIRECT");
        expect(utiNext50?.option).toBe("GROWTH");

        const nipponGold = funds.find(f => f.isin === "INF204K01YC4");
        expect(nipponGold).toBeDefined();
        expect(nipponGold?.currentUnits).toBe(22.177);

        const hdfcMidcap = funds.find(f => f.isin === "INF179KC1GC8");
        expect(hdfcMidcap).toBeDefined();
        expect(hdfcMidcap?.currentUnits).toBe(124.526);

        const uti50 = funds.find(f => f.isin === "INF789F01XA0");
        expect(uti50).toBeDefined();
        expect(uti50?.currentUnits).toBe(44.241);

        // Test Deduplication: Re-running with the same messageId should skip
        const repeatRes = await ingestMutualFundDepositoryAlert({
            messageId: "msg_test_cdsl_123",
            content: cdslEmailContent,
            timestamp: new Date()
        });

        expect(repeatRes.skippedCount).toBe(4);
        expect(repeatRes.createdCount).toBe(0);
        expect(repeatRes.updatedCount).toBe(0);
    }, 20000);
});
