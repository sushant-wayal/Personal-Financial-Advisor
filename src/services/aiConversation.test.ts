import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    fallbackName,
    fallbackExpiresInDays,
    getConversationExpiryInfo,
    evaluateConversationMetadata,
    saveOrUpdateConversation,
    deleteExpiredConversations,
    searchConversations,
    parseConversationTurns,
    extractConversationDialogueText,
} from "./aiConversation";
import * as geminiModule from "./gemini";
import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => {
    return {
        prisma: {
            aIMemory: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                deleteMany: vi.fn(),
            },
        },
        default: {
            aIMemory: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
                count: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                deleteMany: vi.fn(),
            },
        },
    };
});

describe("aiConversation domain service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("fallbackName", () => {
        it("creates capitalized title from question", () => {
            expect(fallbackName("can i afford this vacation?")).toBe("Can i afford this vacation");
        });

        it("truncates long questions gracefully with ellipsis", () => {
            const longQ = "Should I invest all my surplus money into gold and mutual funds right now";
            const name = fallbackName(longQ);
            expect(name.length).toBeLessThanOrEqual(40);
            expect(name.endsWith("…")).toBe(true);
        });

        it("preserves existingName if present", () => {
            expect(fallbackName("new question", "Emergency Fund Plan")).toBe("Emergency Fund Plan");
        });

        it("returns default title if question is empty", () => {
            expect(fallbackName("")).toBe("AI Conversation");
            expect(fallbackName(undefined)).toBe("AI Conversation");
        });
    });

    describe("fallbackExpiresInDays", () => {
        it("assigns 180 days to long-term wealth/retirement/home questions", () => {
            expect(fallbackExpiresInDays("How much should I save for retirement?")).toBe(180);
            expect(fallbackExpiresInDays("Planning to buy a home in 5 years")).toBe(180);
        });

        it("assigns 90 days to goal/investment/emergency fund queries", () => {
            expect(fallbackExpiresInDays("What is my emergency fund target?")).toBe(90);
            expect(fallbackExpiresInDays("Review my mutual fund portfolio")).toBe(90);
        });

        it("assigns 7 days to ephemeral daily/spend checks", () => {
            expect(fallbackExpiresInDays("Can I buy this dinner today?")).toBe(7);
            expect(fallbackExpiresInDays("How much did I spend on lunch yesterday?")).toBe(7);
        });

        it("defaults to 30 days for general queries", () => {
            expect(fallbackExpiresInDays("General overview of finances")).toBe(30);
        });
    });

    describe("getConversationExpiryInfo", () => {
        const baseNow = new Date("2026-09-17T12:00:00Z");

        it("returns 'Never expires' for null or undefined", () => {
            const res = getConversationExpiryInfo(null, baseNow);
            expect(res.isExpired).toBe(false);
            expect(res.expiresInDays).toBeNull();
            expect(res.label).toBe("Never expires");
        });

        it("formats future expiration properly", () => {
            const future = new Date("2026-09-24T12:00:00Z"); // 7 days
            const res = getConversationExpiryInfo(future, baseNow);
            expect(res.isExpired).toBe(false);
            expect(res.expiresInDays).toBe(7);
            expect(res.label).toBe("Expires in 7 days");
        });

        it("identifies expired date and formats correctly", () => {
            const past = new Date("2026-09-14T12:00:00Z"); // 3 days ago
            const res = getConversationExpiryInfo(past, baseNow);
            expect(res.isExpired).toBe(true);
            expect(res.label).toBe("Expired 3d ago");
        });

        it("identifies expires today", () => {
            const todayLater = new Date("2026-09-17T12:05:00Z");
            const res = getConversationExpiryInfo(todayLater, baseNow);
            expect(res.isExpired).toBe(false);
            expect(res.expiresInDays).toBe(1);
        });
    });

    describe("evaluateConversationMetadata", () => {
        it("parses LLM response when Gemini succeeds", async () => {
            vi.spyOn(geminiModule, "generateText").mockResolvedValueOnce({
                text: JSON.stringify({
                    name: "House Down Payment Strategy",
                    expiresInDays: 120,
                    reason: "Long term real estate savings goal",
                }),
            });

            const res = await evaluateConversationMetadata({
                question: "How should I save for a house down payment?",
                response: "Set aside ₹50,000 monthly in debt funds.",
            });

            expect(res.name).toBe("House Down Payment Strategy");
            expect(res.expiresInDays).toBe(120);
            expect(res.reason).toBe("Long term real estate savings goal");
            expect(res.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        it("falls back gracefully when LLM fails or throws", async () => {
            vi.spyOn(geminiModule, "generateText").mockRejectedValueOnce(new Error("API timeout"));

            const res = await evaluateConversationMetadata({
                question: "Can I buy shoes today?",
                response: "Yes, you have ₹5,000 in your shopping budget.",
            });

            expect(res.name).toBe("Can I buy shoes today");
            expect(res.expiresInDays).toBe(7);
            expect(res.reason).toBe("Fallback heuristic applied");
        });
    });

    describe("saveOrUpdateConversation", () => {
        it("creates a new conversation record with LLM metadata when not existing", async () => {
            (prisma.aIMemory.findFirst as any).mockResolvedValueOnce(null);
            (prisma.aIMemory.create as any).mockImplementationOnce(async ({ data }: any) => ({
                id: "mem_1",
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            }));

            vi.spyOn(geminiModule, "generateText").mockResolvedValueOnce({
                text: JSON.stringify({
                    name: "Emergency Fund Planning",
                    expiresInDays: 45,
                    reason: "Quarterly liquidity target",
                }),
            });

            const res = await saveOrUpdateConversation({
                conversationId: "conv_123",
                question: "How much emergency fund do I need?",
                response: "You need 6 months of expenses, approximately ₹3,00,000.",
            });

            expect(res.isNew).toBe(true);
            expect(res.conversation.name).toBe("Emergency Fund Planning");
            expect(res.conversation.key).toBe("chat:conv_123");
            expect(prisma.aIMemory.create).toHaveBeenCalledTimes(1);
        });

        it("updates existing conversation and refreshes name and expiresAt", async () => {
            const existing = {
                id: "mem_1",
                key: "chat:conv_123",
                name: "Old Name",
                expiresAt: new Date("2026-09-01T00:00:00Z"),
                value: "Old response",
                tags: JSON.stringify(["chat"]),
            };

            (prisma.aIMemory.findFirst as any).mockResolvedValueOnce(existing);
            (prisma.aIMemory.update as any).mockImplementationOnce(async ({ data }: any) => ({
                ...existing,
                ...data,
                updatedAt: new Date(),
            }));

            vi.spyOn(geminiModule, "generateText").mockResolvedValueOnce({
                text: JSON.stringify({
                    name: "Updated Emergency & Health Plan",
                    expiresInDays: 60,
                    reason: "Expanded into health insurance",
                }),
            });

            const res = await saveOrUpdateConversation({
                conversationId: "conv_123",
                question: "Also check my health insurance coverage",
                response: "You have a ₹10,000,000 base policy.",
            });

            expect(res.isNew).toBe(false);
            expect(res.conversation.name).toBe("Updated Emergency & Health Plan");
            expect(prisma.aIMemory.update).toHaveBeenCalledTimes(1);
            const updateArgs = (prisma.aIMemory.update as any).mock.calls[0][0];
            expect(updateArgs.data.name).toBe("Updated Emergency & Health Plan");
            expect(updateArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe("deleteExpiredConversations", () => {
        it("returns 0 deleted count when no expired conversations found", async () => {
            (prisma.aIMemory.findMany as any).mockResolvedValueOnce([]);

            const res = await deleteExpiredConversations(new Date("2026-09-17T12:00:00Z"));
            expect(res.success).toBe(true);
            expect(res.deletedCount).toBe(0);
            expect(prisma.aIMemory.deleteMany).not.toHaveBeenCalled();
        });

        it("deletes all conversations past their expiration timestamp", async () => {
            const expiredItems = [
                { id: "mem_expired_1", key: "chat:1", name: "Quick Lunch Check", expiresAt: new Date("2026-09-10T00:00:00Z") },
                { id: "mem_expired_2", key: "chat:2", name: "Grocery Check", expiresAt: new Date("2026-09-15T00:00:00Z") },
            ];
            (prisma.aIMemory.findMany as any).mockResolvedValueOnce(expiredItems);
            (prisma.aIMemory.deleteMany as any).mockResolvedValueOnce({ count: 2 });

            const res = await deleteExpiredConversations(new Date("2026-09-17T12:00:00Z"));
            expect(res.success).toBe(true);
            expect(res.deletedCount).toBe(2);
            expect(res.deletedIds).toEqual(["mem_expired_1", "mem_expired_2"]);
            expect(prisma.aIMemory.deleteMany).toHaveBeenCalledWith({
                where: {
                    id: { in: ["mem_expired_1", "mem_expired_2"] },
                },
            });
        });
    });

    describe("searchConversations", () => {
        it("returns paginated conversations with enriched expiry metadata", async () => {
            const mockDbItems = [
                {
                    id: "c1",
                    key: "chat:1",
                    name: "Emergency Fund",
                    value: "Fund details",
                    tags: JSON.stringify(["chat"]),
                    createdAt: new Date("2026-09-01"),
                    updatedAt: new Date("2026-09-01"),
                    expiresAt: new Date("2026-10-01"),
                },
            ];
            (prisma.aIMemory.count as any).mockResolvedValueOnce(1);
            (prisma.aIMemory.findMany as any).mockResolvedValueOnce(mockDbItems);

            const res = await searchConversations({ page: 1, limit: 10 });
            expect(res.conversations.length).toBe(1);
            expect(res.conversations[0].name).toBe("Emergency Fund");
            expect(res.conversations[0].expiryLabel).toBeDefined();
            expect(res.pagination.total).toBe(1);
            expect(res.pagination.page).toBe(1);
            expect(res.pagination.hasMore).toBe(false);
        });

        it("searches with query filtering name, value, and key", async () => {
            (prisma.aIMemory.count as any).mockResolvedValueOnce(0);
            (prisma.aIMemory.findMany as any).mockResolvedValueOnce([]);

            const res = await searchConversations({ query: "vacation budget", page: 2, limit: 5 });
            expect(res.pagination.page).toBe(2);
            expect(res.pagination.limit).toBe(5);

            expect(prisma.aIMemory.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 5,
                    take: 5,
                    where: expect.objectContaining({
                        AND: expect.arrayContaining([
                            expect.objectContaining({
                                OR: expect.arrayContaining([
                                    { name: { contains: "vacation budget", mode: "insensitive" } },
                                    { value: { contains: "vacation budget", mode: "insensitive" } },
                                    { key: { contains: "vacation budget", mode: "insensitive" } },
                                ]),
                            }),
                        ]),
                    }),
                })
            );
        });
    });

    describe("parseConversationTurns", () => {
        it("parses valid JSON array of structured turns with rich artifacts", () => {
            const raw = JSON.stringify([
                {
                    question: "What is my net worth?",
                    response: {
                        narrative: "Your net worth is ₹15,00,000.",
                        artifacts: [
                            { type: "healthCard", title: "Financial Health", status: "healthy" },
                            { type: "metricsGrid", metrics: [{ label: "Net Worth", value: "₹15L" }] },
                        ],
                    },
                },
            ]);
            const turns = parseConversationTurns(raw);
            expect(turns.length).toBe(1);
            expect(turns[0].question).toBe("What is my net worth?");
            expect(turns[0].response.narrative).toBe("Your net worth is ₹15,00,000.");
            expect(turns[0].response.artifacts.length).toBe(2);
            expect(turns[0].response.artifacts[0].type).toBe("healthCard");
        });

        it("wraps plain narrative string into a single turn", () => {
            const plain = "Here is your monthly summary with surplus of ₹20,000.";
            const turns = parseConversationTurns(plain);
            expect(turns.length).toBe(1);
            expect(turns[0].question).toBe("Conversation History");
            expect(turns[0].response.narrative).toBe(plain);
            expect(turns[0].response.artifacts).toEqual([]);
        });

        it("returns empty array for empty or whitespace string", () => {
            expect(parseConversationTurns("")).toEqual([]);
            expect(parseConversationTurns("   ")).toEqual([]);
        });
    });

    describe("Multi-turn accumulation & artifact preservation", () => {
        it("accumulates multiple turns and stores full artifacts in the conversation record", async () => {
            const existingTurns = [
                {
                    question: "Turn 1: Budget check",
                    response: {
                        narrative: "You have ₹25,000 left.",
                        artifacts: [{ type: "healthCard", title: "Budget OK", status: "healthy" }],
                    },
                },
            ];

            const existingRecord = {
                id: "mem_multi",
                key: "chat:session_abc",
                name: "Budget Session",
                expiresAt: new Date(Date.now() + 86400000),
                value: JSON.stringify(existingTurns),
                tags: JSON.stringify(["chat"]),
            };

            (prisma.aIMemory.findFirst as any).mockResolvedValueOnce(existingRecord);
            (prisma.aIMemory.update as any).mockImplementationOnce(async ({ data }: any) => ({
                ...existingRecord,
                ...data,
            }));

            vi.spyOn(geminiModule, "generateText").mockResolvedValueOnce({
                text: JSON.stringify({
                    name: "Budget & Savings Session",
                    expiresInDays: 30,
                    reason: "Ongoing budget review",
                }),
            });

            const newTurnArtifact = {
                type: "comparisonTable",
                title: "Spending Comparison",
                columns: ["Category", "Spent"],
                rows: [{ label: "Food", values: ["₹5,000"] }],
            };

            const res = await saveOrUpdateConversation({
                conversationId: "session_abc",
                question: "Turn 2: How does dining compare to groceries?",
                response: {
                    narrative: "Dining is ₹5,000 while groceries are ₹12,000.",
                    artifacts: [newTurnArtifact],
                },
            });

            expect(res.isNew).toBe(false);
            expect(prisma.aIMemory.update).toHaveBeenCalledTimes(1);
            const updateArgs = (prisma.aIMemory.update as any).mock.calls[0][0];
            const savedTurns = JSON.parse(updateArgs.data.value);
            expect(savedTurns.length).toBe(2);
            expect(savedTurns[0].question).toBe("Turn 1: Budget check");
            expect(savedTurns[1].question).toBe("Turn 2: How does dining compare to groceries?");
            expect(savedTurns[1].response.artifacts[0].type).toBe("comparisonTable");
        });
    });

    describe("extractConversationDialogueText", () => {
        it("extracts clean dialogue without raw artifacts", () => {
            const raw = JSON.stringify([
                {
                    question: "Can I afford dinner?",
                    response: {
                        narrative: "Yes, you have enough in dining budget.",
                        artifacts: [{ type: "healthCard", title: "Dining Budget" }],
                    },
                },
            ]);

            const text = extractConversationDialogueText(raw);
            expect(text).toContain("User: Can I afford dinner?");
            expect(text).toContain("Advisor: Yes, you have enough in dining budget.");
            expect(text).not.toContain("healthCard");
        });
    });
});
