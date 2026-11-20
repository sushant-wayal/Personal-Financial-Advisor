/**
 * liveQuotes.ts — Real-time Stock Quote & Market Status Service for North Stock Intelligence.
 *
 * Responsibilities:
 *   - Near-real-time quote fetching with 2.5-second in-memory coalescing cache.
 *   - Multi-symbol batching to Yahoo Finance quote API.
 *   - Fallback to 1-minute chart API when quote endpoint is restricted.
 *   - Accurate NSE/BSE market session detection (OPEN, PRE_OPEN, POST_CLOSE, CLOSED).
 *   - Pure domain functions, testable and decoupled from Next.js HTTP layer.
 */

import { isStockTradingDay } from "./exchangeCalendar";
import { DATA_FRESHNESS_CONFIG } from "../../config/stockEngineDefaults";

export type MarketSessionState = "REGULAR" | "PRE_OPEN" | "POST_CLOSE" | "CLOSED";

export interface MarketStatus {
  isOpen: boolean;
  session: MarketSessionState;
  dateStr: string;
  message: string;
  timeStr: string;
}

export interface LiveStockQuote {
  symbol: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  volume?: number;
  lastUpdated: string;
}

// ─── Market Status Classification ────────────────────────────────────────────

/**
 * Computes Indian equity market session state (Asia/Kolkata timezone).
 * Trading hours:
 *   09:00 - 09:15 IST : Pre-open session
 *   09:15 - 15:30 IST : Regular market trading (Open)
 *   15:30 - 16:00 IST : Post-close closing price finalization
 *   All other times / weekends / holidays : Closed
 */
export function getExchangeMarketStatus(date: Date = new Date()): MarketStatus {
  const tradingDayCheck = isStockTradingDay(date);

  // Get current time in Asia/Kolkata (HH:MM:SS)
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const timeParts = timeFormatter.formatToParts(date);
  const hour = parseInt(timeParts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(timeParts.find((p) => p.type === "minute")?.value || "0", 10);
  const totalMinutes = hour * 60 + minute;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} IST`;

  if (!tradingDayCheck.isTradingDay) {
    return {
      isOpen: false,
      session: "CLOSED",
      dateStr: tradingDayCheck.dateStr,
      message: tradingDayCheck.reason || "Market Closed (Non-Trading Day)",
      timeStr,
    };
  }

  // 09:00 = 540 min, 09:15 = 555 min, 15:30 = 930 min, 16:00 = 960 min
  if (totalMinutes < 540) {
    return {
      isOpen: false,
      session: "CLOSED",
      dateStr: tradingDayCheck.dateStr,
      message: "Market Closed (Opens at 09:15 AM IST)",
      timeStr,
    };
  }

  if (totalMinutes < 555) {
    return {
      isOpen: false,
      session: "PRE_OPEN",
      dateStr: tradingDayCheck.dateStr,
      message: "Pre-Open Session (09:00 - 09:15 AM IST)",
      timeStr,
    };
  }

  if (totalMinutes <= 930) {
    return {
      isOpen: true,
      session: "REGULAR",
      dateStr: tradingDayCheck.dateStr,
      message: "Market Open • Live NSE Session",
      timeStr,
    };
  }

  if (totalMinutes <= 960) {
    return {
      isOpen: false,
      session: "POST_CLOSE",
      dateStr: tradingDayCheck.dateStr,
      message: "Post-Close Session (03:30 - 04:00 PM IST)",
      timeStr,
    };
  }

  return {
    isOpen: false,
    session: "CLOSED",
    dateStr: tradingDayCheck.dateStr,
    message: "Market Closed (Closed at 03:30 PM IST)",
    timeStr,
  };
}

// ─── In-Memory Cache for Call Coalescing ──────────────────────────────────────

const CACHE_TTL_MS = 2500; // 2.5 seconds cache TTL
const quoteCache = new Map<string, { quote: LiveStockQuote; expiresAt: number }>();

/**
 * Resets the in-memory quote cache (useful for testing).
 */
export function clearLiveQuoteCache(): void {
  quoteCache.clear();
}

/**
 * Maps standard Indian tickers to Yahoo Finance query symbols.
 */
export function toYahooQuoteSymbol(symbol: string, exchange: string = "NSE"): string {
  const clean = symbol.trim().toUpperCase();
  if (clean.includes(".")) return clean;
  const ex = exchange.trim().toUpperCase();
  if (ex === "BSE") return `${clean}.BO`;
  return `${clean}.NS`;
}

/**
 * Extracts clean base ticker from Yahoo query symbol.
 */
export function fromYahooQuoteSymbol(yahooSymbol: string): string {
  const upper = yahooSymbol.toUpperCase();
  if (upper.endsWith(".NS") || upper.endsWith(".BO")) {
    return upper.slice(0, -3);
  }
  return upper;
}

// ─── Live Quote Fetching ─────────────────────────────────────────────────────

/**
 * Fetches real-time stock quotes for a list of symbols.
 * Utilizes short-lived in-memory caching to coalesce concurrent requests
 * from web, mobile, and multiple client widgets.
 */
export async function fetchLiveQuotes(
  symbols: string[],
  exchange: string = "NSE"
): Promise<Record<string, LiveStockQuote>> {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  const now = Date.now();
  const results: Record<string, LiveStockQuote> = {};
  const uncachedSymbols: string[] = [];

  // 1. Check in-memory cache
  for (const rawSym of symbols) {
    const symbol = rawSym.trim().toUpperCase();
    if (!symbol) continue;

    const cached = quoteCache.get(symbol);
    if (cached && cached.expiresAt > now) {
      results[symbol] = cached.quote;
    } else {
      uncachedSymbols.push(symbol);
    }
  }

  if (uncachedSymbols.length === 0) {
    return results;
  }

  // 2. Fetch uncached symbols in batch from Yahoo Finance quote endpoint
  const yahooSymbols = uncachedSymbols.map((s) => toYahooQuoteSymbol(s, exchange));
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    yahooSymbols.join(",")
  )}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const quoteList = data?.quoteResponse?.result;

      if (Array.isArray(quoteList) && quoteList.length > 0) {
        for (const item of quoteList) {
          const rawTicker = item.symbol as string;
          const cleanTicker = fromYahooQuoteSymbol(rawTicker);
          const price = Number(item.regularMarketPrice ?? 0);
          const change = Number(item.regularMarketChange ?? 0);
          const changePercent = Number(item.regularMarketChangePercent ?? 0);
          const dayHigh = item.regularMarketDayHigh != null ? Number(item.regularMarketDayHigh) : undefined;
          const dayLow = item.regularMarketDayLow != null ? Number(item.regularMarketDayLow) : undefined;
          const previousClose =
            item.regularMarketPreviousClose != null ? Number(item.regularMarketPreviousClose) : undefined;
          const volume = item.regularMarketVolume != null ? Number(item.regularMarketVolume) : undefined;

          const quoteObj: LiveStockQuote = {
            symbol: cleanTicker,
            exchange,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            dayHigh: dayHigh != null ? Math.round(dayHigh * 100) / 100 : undefined,
            dayLow: dayLow != null ? Math.round(dayLow * 100) / 100 : undefined,
            previousClose: previousClose != null ? Math.round(previousClose * 100) / 100 : undefined,
            volume,
            lastUpdated: new Date().toISOString(),
          };

          quoteCache.set(cleanTicker, { quote: quoteObj, expiresAt: now + CACHE_TTL_MS });
          results[cleanTicker] = quoteObj;
        }
      }
    }
  } catch (err) {
    console.warn("[liveQuotes] Batch quote fetch failed, trying chart fallbacks:", err);
  }

  // 3. Fallback for any symbols that failed the batch quote query
  for (const sym of uncachedSymbols) {
    if (results[sym]) continue;

    try {
      const querySym = toYahooQuoteSymbol(sym, exchange);
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        querySym
      )}?interval=1d&range=1d`;
      const fallbackRes = await fetch(chartUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (fallbackRes.ok) {
        const chartData = await fallbackRes.json();
        const meta = chartData?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice != null) {
          const price = Number(meta.regularMarketPrice);
          const prevClose = meta.chartPreviousClose != null ? Number(meta.chartPreviousClose) : price;
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          const quoteObj: LiveStockQuote = {
            symbol: sym,
            exchange,
            price: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
            dayHigh: meta.regularMarketDayHigh != null ? Math.round(Number(meta.regularMarketDayHigh) * 100) / 100 : undefined,
            dayLow: meta.regularMarketDayLow != null ? Math.round(Number(meta.regularMarketDayLow) * 100) / 100 : undefined,
            previousClose: Math.round(prevClose * 100) / 100,
            lastUpdated: new Date().toISOString(),
          };

          quoteCache.set(sym, { quote: quoteObj, expiresAt: now + CACHE_TTL_MS });
          results[sym] = quoteObj;
        }
      }
    } catch (fallbackErr) {
      console.error(`[liveQuotes] Fallback chart fetch failed for ${sym}:`, fallbackErr);
    }
  }

  return results;
}
