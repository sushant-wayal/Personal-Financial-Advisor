import { prisma } from "../lib/prisma";
import { generateText } from "./gemini";

export async function buildFinancialContext(limit = 100) {
    const transactions = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: limit });
    const goals = await prisma.goal.findMany({ orderBy: { priority: "asc" } });
    const profile = await prisma.financialProfile.findFirst();
    const subs = await prisma.subscription.findMany();
    const memories = await prisma.aIMemory.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

    return { transactions, goals, profile, subscriptions: subs, memories };
}

export async function askAdvisor(question: string) {
    const context = await buildFinancialContext(200);
    console.log('Financial context for advisor:', context);
    const system = `You are a disciplined, analytical personal finance advisor. Use only the provided financial context and deterministic calculations. Do not hallucinate. Provide clear numeric analysis.`;
    const userMessage = `Context: ${JSON.stringify(context)}\n\nQuestion: ${question}`;
    const resp = await generateText([
        { role: 'system', content: system },
        { role: 'user', content: userMessage }
    ], { temperature: 0.05, maxTokens: 1200, complexity: "complex" });
    return resp;
}
