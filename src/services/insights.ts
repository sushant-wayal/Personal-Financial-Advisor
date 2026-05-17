import { prisma } from "../lib/prisma";
import { generateText } from "./gemini";

export async function generateInsights(limit = 50) {
    const txs = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: limit, include: { category: true } });
    const insights: any[] = [];

    // heuristic: detect large single expenses ( > 3x median)
    const amounts = txs.map((t: any) => Math.abs(t.amount)).sort((a: number, b: number) => a - b);
    const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
    for (const t of txs) {
        if (median > 0 && Math.abs(t.amount) > median * 3) {
            insights.push({ type: "large_expense", message: `Large expense of ₹${t.amount} at ${t.merchant}`, score: Math.min(100, (Math.abs(t.amount) / Math.max(1, median)) * 10) });
        }
    }

    // heuristic: detect spikes in categories
    const byCat: Record<string, number[]> = {};
    for (const t of txs) {
        const k = (t.category?.name || "Miscellaneous").toString();
        if (!byCat[k]) byCat[k] = [];
        byCat[k].push(Math.abs(t.amount));
    }
    for (const k of Object.keys(byCat)) {
        const arr = byCat[k];
        const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
        if (avg > 10000) insights.push({ type: "category_spike", message: `High average spend in ${k}: ₹${Math.round(avg)}/txn`, score: Math.min(100, avg / 100) });
    }

    // store as FinancialInsight records
    for (const ins of insights) {
        await prisma.financialInsight.create({ data: { type: ins.type, message: ins.message, score: ins.score || null, meta: ins.meta ? JSON.stringify(ins.meta) : null } });
    }

    // Use Gemini only to summarize and produce user-facing guidance when many transactions exist
    if (txs.length > 10 && process.env.GEMINI_API_KEY) {
        const prompt = `Summarize user's recent transactions and provide 3 concrete insights and one recommended action. Transactions: ${JSON.stringify(txs.slice(0, 50))}`;
        try {
            const resp = await generateText(prompt, { temperature: 0.1, maxTokens: 400 });
            await prisma.financialInsight.create({ data: { type: "ai_summary", message: resp.text, meta: resp.raw ? JSON.stringify(resp.raw) : null } });
            insights.push({ type: "ai_summary", message: resp.text });
        } catch (e) {
            // ignore AI errors
        }
    }

    return insights;
}

export async function listInsights(limit = 50) {
    return prisma.financialInsight.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}
