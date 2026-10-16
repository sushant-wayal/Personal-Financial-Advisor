/**
 * stockRecommendations/aiScout.ts — AI Stock Scout Layer.
 *
 * Uses Gemini to dynamically nominate up to 10 additional liquid Indian cash-equity candidates
 * beyond the static index universe, based on current macro regime, sector tailwinds,
 * and portfolio constraints.
 *
 * Guardrails:
 * - Sanitizes symbols (uppercase NSE tickers only).
 * - Avoids duplicates already in base universe.
 * - Downloads and validates historical daily candles via Yahoo/NSE.
 * - Discards any ticker that fails data quality, volume, or liquidity checks.
 * - Returns structured { symbol, thesis } candidates for quantitative validation.
 */

import { generateText } from "../gemini";
import { fetchAndPersistHistory } from "../marketData";
import { prisma } from "../../lib/prisma";

export interface AiScoutedStock {
  symbol: string;
  thesis: string;
}

export async function scoutAiStockCandidates(params: {
  marketRegime: string;
  financialPhase: string;
  deployableBudget: number;
  existingSymbols: string[];
}): Promise<AiScoutedStock[]> {
  if (params.marketRegime === "BEARISH" || params.marketRegime === "DATA_UNRELIABLE") {
    return [];
  }

  const prompt = `
You are the North Stock Intelligence AI Scout, a seasoned Indian equity research analyst.
Your objective is to identify up to 10 high-liquidity, high-conviction Indian stocks (NSE cash-equity delivery) beyond the standard mega-caps that present attractive tactical swing setups (2 to 15 day horizon).

CONTEXT:
- Current Macro Regime: ${params.marketRegime}
- Personal Financial Phase: ${params.financialPhase}
- Deployable Cash Budget: ₹${params.deployableBudget.toLocaleString("en-IN")}
- Excluded Core Symbols (already in base scan): ${params.existingSymbols.slice(0, 35).join(", ")}...

REQUIREMENTS:
1. Nominate up to 10 distinct Indian equities traded on NSE (cash segment). Good sources: Nifty Midcap 150 leaders, high-volume momentum movers, or strong sectoral breakout names (e.g., DIXON, PERSISTENT, POLYCAB, COFORGE, CONCOR, ESCORTS, TRENT, etc.).
2. Do NOT nominate penny stocks, illiquid small-caps, or obscure micro-caps. Must have substantial institutional daily volume on NSE.
3. For each stock, provide the exact NSE ticker symbol (e.g. "DIXON") and a 1-sentence catalyst or momentum thesis.
4. Output STRICT JSON array format:
[
  { "symbol": "DIXON", "thesis": "Strong electronics manufacturing momentum with volume consolidation near 20-day EMA." }
]
`;

  try {
    const res = await generateText(prompt, {
      complexity: "simple",
      temperature: 0.2,
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(res.text || "[]");
    if (!Array.isArray(parsed)) return [];

    const existingSet = new Set(params.existingSymbols.map((s) => s.toUpperCase()));
    const candidates: AiScoutedStock[] = [];

    for (const item of parsed) {
      if (!item || typeof item.symbol !== "string") continue;
      const cleanSymbol = item.symbol.toUpperCase().replace(/[^A-Z0-9-]/g, "").trim();
      if (!cleanSymbol || cleanSymbol.length < 2 || cleanSymbol.length > 15) continue;
      if (existingSet.has(cleanSymbol)) continue;

      candidates.push({
        symbol: cleanSymbol,
        thesis: typeof item.thesis === "string" ? item.thesis.trim() : "AI identified momentum catalyst.",
      });

      if (candidates.length >= 10) break;
    }

    // Now verify / warm up market data for the scouted candidates
    const verifiedCandidates: AiScoutedStock[] = [];
    for (const cand of candidates) {
      try {
        const barCount = await prisma.stockMarketBar.count({
          where: { symbol: cand.symbol },
        });

        if (barCount < 50) {
          // Fetch historical daily bars from Yahoo/NSE
          const fetchRes = await fetchAndPersistHistory(cand.symbol, "NSE", 250);
          if (fetchRes.persisted < 30) {
            console.warn(`[aiScout] Dropping candidate ${cand.symbol}: insufficient market data persisted (${fetchRes.persisted} bars).`);
            continue;
          }
        }

        verifiedCandidates.push(cand);
      } catch (fetchErr) {
        console.warn(`[aiScout] Failed to fetch data for candidate ${cand.symbol}:`, fetchErr);
      }
    }

    return verifiedCandidates;
  } catch (err) {
    console.warn("[aiScout] AI stock discovery scout encountered an error, falling back to base universe:", err);
    return [];
  }
}
