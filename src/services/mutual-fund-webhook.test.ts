import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ingestMutualFundDepositoryAlert } from "./mutual-fund-webhook.service";
import { prisma } from "../lib/prisma";

interface MockFundRecord {
    id: string;
    schemeName: string;
    schemeCode: string | null;
    isin: string;
    planType: string;
    option: string;
    currentUnits: number;
    currentNav: number | null;
    currentWorth: number | null;
    setupDate: Date;
    processedMessageIds: string[];
}

let mockFunds: MockFundRecord[] = [];

vi.mock("./amfi-service", () => ({
    resolveMutualFundByIsin: vi.fn().mockResolvedValue(null)
}));

vi.mock("../lib/prisma", () => ({
    prisma: {
        mutualFund: {
            deleteMany: vi.fn().mockImplementation((args?: { where?: { isin?: { in?: string[] } } }) => {
                const targetIsins = args?.where?.isin?.in;
                if (targetIsins) {
                    mockFunds = mockFunds.filter(f => !targetIsins.includes(f.isin));
                } else {
                    mockFunds = [];
                }
                return Promise.resolve({ count: mockFunds.length });
            }),
            findFirst: vi.fn().mockImplementation((args?: { where?: { isin?: string; OR?: Array<{ processedMessageIds?: { has?: string }; isin?: string; schemeCode?: string; schemeName?: { equals?: string } }> } }) => {
                const where = args?.where;
                if (!where) return Promise.resolve(mockFunds[0] || null);

                const found = mockFunds.find(fund => {
                    // Deduplication check
                    if (where.isin && where.OR) {
                        const isinMatch = fund.isin === where.isin;
                        const orMatch = where.OR.some(clause => {
                            if (clause.processedMessageIds?.has) {
                                return fund.processedMessageIds.includes(clause.processedMessageIds.has);
                            }
                            return false;
                        });
                        return isinMatch && orMatch;
                    }

                    // Existing fund check
                    if (where.OR) {
                        return where.OR.some(clause => {
                            if (clause.isin && fund.isin === clause.isin) return true;
                            if (clause.schemeCode && fund.schemeCode === clause.schemeCode) return true;
                            if (clause.schemeName?.equals && fund.schemeName.toLowerCase() === clause.schemeName.equals.toLowerCase()) return true;
                            return false;
                        });
                    }

                    if (where.isin) {
                        return fund.isin === where.isin;
                    }

                    return false;
                });

                return Promise.resolve(found || null);
            }),
            findMany: vi.fn().mockImplementation((args?: { where?: { isin?: { in?: string[] } } }) => {
                const targetIsins = args?.where?.isin?.in;
                if (targetIsins) {
                    return Promise.resolve(mockFunds.filter(f => targetIsins.includes(f.isin)));
                }
                return Promise.resolve([...mockFunds]);
            }),
            create: vi.fn().mockImplementation((args: { data: Omit<MockFundRecord, "id"> }) => {
                const record: MockFundRecord = {
                    id: `fund_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    schemeName: args.data.schemeName,
                    schemeCode: args.data.schemeCode ?? null,
                    isin: args.data.isin,
                    planType: args.data.planType ?? "DIRECT",
                    option: args.data.option ?? "GROWTH",
                    currentUnits: args.data.currentUnits,
                    currentNav: args.data.currentNav ?? null,
                    currentWorth: args.data.currentWorth ?? null,
                    setupDate: args.data.setupDate || new Date(),
                    processedMessageIds: args.data.processedMessageIds || []
                };
                mockFunds.push(record);
                return Promise.resolve(record);
            }),
            update: vi.fn().mockImplementation((args: { where: { id: string }; data: Partial<MockFundRecord> }) => {
                const idx = mockFunds.findIndex(f => f.id === args.where.id);
                if (idx !== -1) {
                    mockFunds[idx] = {
                        ...mockFunds[idx],
                        ...args.data,
                    };
                    return Promise.resolve(mockFunds[idx]);
                }
                return Promise.resolve(null);
            }),
        }
    }
}));

describe("Mutual Fund Depository Ingestion", () => {
    beforeEach(async () => {
        mockFunds = [];
        // Clean up mock test mutual funds only
        await prisma.mutualFund.deleteMany({
            where: {
                isin: { in: ["INFTEST00001", "INFTEST00002", "INFTEST00003", "INFTEST00004"] }
            }
        });
    });

    afterEach(async () => {
        mockFunds = [];
        // Clean up mock test mutual funds only
        await prisma.mutualFund.deleteMany({
            where: {
                isin: { in: ["INFTEST00001", "INFTEST00002", "INFTEST00003", "INFTEST00004"] }
            }
        });
    });

    it("should auto-create mutual funds from CDSL email body", async () => {
        const cdslEmailContent = `Dear MR. TEST USER,
Following is/are the list of transactions for your Demat account ending with *91842623
Sr. No.
Company Name
ISIN
Quantity
Debit / Credit
Date and Time
1
UTI AMC LTD#UTI MF-UTI NIFTY NEXT 50 INDEX FUND-DIRECT-GROWTH
INFTEST00001
90.507
Credit
28/08/2026 18:22:46
2
NIPPON LIFE INDIA AM LTD#NIPPON INDIA MF-NIPPON INDIAGOLD SAVINGS FUND DIRECT PLAN GROWTH
INFTEST00002
22.177
Credit
28/08/2026 18:22:38
3
HDFC AMC LTD#HDFC MF-HDFC NIFTY MIDCAP 150 INDEX FUND-DIRECT-GROWTH
INFTEST00003
124.526
Credit
28/08/2026 18:22:24
4
UTI AMC LTD # UTI MF-UTI NIFTY 50 INDEX FUND DIRECT PLAN GROWTH
INFTEST00004
44.241
Credit
28/08/2026 18:23:05
For further queries, please contact your Depository Participant [DP] with whom you hold your demat account.Yours Truly,
Central Depository Services (India) Ltd`;

        const res = await ingestMutualFundDepositoryAlert({
            messageId: "msg_test_cdsl_unique_123",
            content: cdslEmailContent,
            timestamp: new Date()
        });

        expect(res.ok).toBe(true);
        expect(res.createdCount).toBe(4);
        expect(res.processedCount).toBe(4);

        // Verify DB records
        const funds = await prisma.mutualFund.findMany({
            where: {
                isin: { in: ["INFTEST00001", "INFTEST00002", "INFTEST00003", "INFTEST00004"] }
            }
        });

        expect(funds).toHaveLength(4);

        const utiNext50 = funds.find(f => f.isin === "INFTEST00001");
        expect(utiNext50).toBeDefined();
        expect(utiNext50?.currentUnits).toBe(90.507);
        expect(utiNext50?.planType).toBe("DIRECT");
        expect(utiNext50?.option).toBe("GROWTH");

        const nipponGold = funds.find(f => f.isin === "INFTEST00002");
        expect(nipponGold).toBeDefined();
        expect(nipponGold?.currentUnits).toBe(22.177);

        const hdfcMidcap = funds.find(f => f.isin === "INFTEST00003");
        expect(hdfcMidcap).toBeDefined();
        expect(hdfcMidcap?.currentUnits).toBe(124.526);

        const uti50 = funds.find(f => f.isin === "INFTEST00004");
        expect(uti50).toBeDefined();
        expect(uti50?.currentUnits).toBe(44.241);

        // Test Deduplication: Re-running with the same messageId should skip
        const repeatRes = await ingestMutualFundDepositoryAlert({
            messageId: "msg_test_cdsl_unique_123",
            content: cdslEmailContent,
            timestamp: new Date()
        });

        expect(repeatRes.skippedCount).toBe(4);
        expect(repeatRes.createdCount).toBe(0);
        expect(repeatRes.updatedCount).toBe(0);
    }, 20000);
});
