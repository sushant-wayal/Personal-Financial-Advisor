/**
 * marketData/index.ts — Market Data Layer for North Stock Intelligence.
 *
 * Responsibilities:
 *   - Fetch daily OHLCV candles from Yahoo Finance (free, ₹0 budget)
 *   - Validate candle data quality
 *   - Persist to StockMarketBar table with deduplication
 *   - Incremental fetching (only fetch missing dates)
 *   - Retry with exponential backoff
 *   - Provider health tracking
 *   - Data freshness assessment
 *
 * This module does NOT interpret market data — it only collects, validates,
 * and serves it. Analysis lives in stockAnalysis/.
 */

import { prisma } from "../../lib/prisma";
import {
  DATA_FRESHNESS_CONFIG,
  DEFAULT_UNIVERSE_SYMBOLS,
} from "../../config/stockEngineDefaults";
import type { MarketBar, DataQuality, DataProviderStatus, MarketDataFreshness } from "../../types/stockIntelligence";

// ─── Yahoo Finance Data Fetcher ──────────────────────────────────────────────

function buildYahooSymbol(symbol: string, exchange: string = "NSE"): string {
  const ex = exchange.toUpperCase().trim();
  if (ex === "NSE") return `${symbol}.NS`;
  if (ex === "BSE") return `${symbol}.BO`;
  return symbol;
}

/**
 * Fetch historical daily candles from Yahoo Finance chart API.
 * Returns raw parsed candles or null on failure.
 */
async function fetchYahooCandles(
  symbol: string,
  exchange: string,
  startDate: Date,
  endDate: Date,
): Promise<{ candles: MarketBar[]; error: string | null }> {
  const yahooSymbol = buildYahooSymbol(symbol, exchange);
  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor(endDate.getTime() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DATA_FRESHNESS_CONFIG.requestTimeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { candles: [], error: `HTTP ${res.status} for ${yahooSymbol}` };
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return { candles: [], error: `No chart result for ${yahooSymbol}` };
    }

    const timestamps = result.timestamp as number[] | undefined;
    const quote = result.indicators?.quote?.[0];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

    if (!timestamps || !quote) {
      return { candles: [], error: `No price data for ${yahooSymbol}` };
    }

    const now = new Date();
    const candles: MarketBar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      const v = quote.volume?.[i];
      const ac = adjClose?.[i] ?? null;

      // Convert timestamp to YYYY-MM-DD in IST
      const dateObj = new Date(ts * 1000);
      const dateStr = dateObj.toLocaleDateString("en-CA", {
        timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
      }); // YYYY-MM-DD format

      const quality = validateCandle(o, h, l, c, v);

      candles.push({
        symbol,
        exchange,
        date: dateStr,
        open: o ?? 0,
        high: h ?? 0,
        low: l ?? 0,
        close: c ?? 0,
        adjustedClose: ac,
        volume: v ?? 0,
        provider: "YAHOO",
        retrievedAt: now,
        quality,
      });
    }

    return { candles, error: null };
  } catch (err: any) {
    const message = err?.name === "AbortError" ? `Timeout fetching ${yahooSymbol}` : `Error: ${err?.message || String(err)}`;
    return { candles: [], error: message };
  }
}

// ─── Candle Validation ───────────────────────────────────────────────────────

function validateCandle(
  open: number | null | undefined,
  high: number | null | undefined,
  low: number | null | undefined,
  close: number | null | undefined,
  volume: number | null | undefined,
): DataQuality {
  // Missing required fields
  if (open == null || high == null || low == null || close == null || volume == null) {
    return "MISSING";
  }

  // Non-finite values
  if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || !Number.isFinite(volume)) {
    return "INVALID";
  }

  // Negative prices or volume
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) {
    return "INVALID";
  }

  // High must be >= all other prices, low must be <= all other prices
  if (high < open || high < close || high < low) {
    return "INVALID";
  }
  if (low > open || low > close || low > high) {
    return "INVALID";
  }

  return "VALID";
}

/**
 * Validates a batch of candles and filters to only VALID ones.
 */
function filterValidCandles(candles: MarketBar[]): { valid: MarketBar[]; rejected: MarketBar[] } {
  const valid: MarketBar[] = [];
  const rejected: MarketBar[] = [];

  for (const candle of candles) {
    if (candle.quality === "VALID") {
      valid.push(candle);
    } else {
      rejected.push(candle);
    }
  }

  return { valid, rejected };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Persist candles to database with upsert (deduplication on symbol+date+provider).
 * Returns count of newly inserted / updated candles.
 */
async function persistCandles(candles: MarketBar[]): Promise<number> {
  let persisted = 0;
  for (const candle of candles) {
    try {
      await prisma.stockMarketBar.upsert({
        where: {
          symbol_date_provider: {
            symbol: candle.symbol,
            date: new Date(candle.date),
            provider: candle.provider,
          },
        },
        create: {
          symbol: candle.symbol,
          exchange: candle.exchange,
          date: new Date(candle.date),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          adjustedClose: candle.adjustedClose,
          volume: candle.volume,
          provider: candle.provider,
          quality: candle.quality,
          retrievedAt: candle.retrievedAt,
        },
        update: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          adjustedClose: candle.adjustedClose,
          volume: candle.volume,
          quality: candle.quality,
          retrievedAt: candle.retrievedAt,
        },
      });
      persisted++;
    } catch (err) {
      console.error(`[marketData] Failed to persist candle for ${candle.symbol} ${candle.date}:`, err);
    }
  }
  return persisted;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch and persist historical candles for a single symbol.
 * Uses incremental fetching — only fetches data after the latest stored date.
 */
export async function fetchAndPersistHistory(
  symbol: string,
  exchange: string = "NSE",
  lookbackDays: number = 400,
): Promise<{ symbol: string; fetched: number; persisted: number; error: string | null }> {
  // Find latest stored date for this symbol
  const latest = await prisma.stockMarketBar.findFirst({
    where: { symbol, provider: "YAHOO" },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const endDate = new Date();
  let startDate: Date;

  if (latest) {
    // Fetch from day after latest stored date
    startDate = new Date(latest.date);
    startDate.setDate(startDate.getDate() + 1);

    // If already up to date, skip
    if (startDate >= endDate) {
      return { symbol, fetched: 0, persisted: 0, error: null };
    }
  } else {
    // Full historical fetch
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - lookbackDays);
  }

  const { candles, error } = await fetchYahooCandles(symbol, exchange, startDate, endDate);
  if (error) {
    return { symbol, fetched: 0, persisted: 0, error };
  }

  const { valid } = filterValidCandles(candles);
  const persisted = await persistCandles(valid);

  return { symbol, fetched: candles.length, persisted, error: null };
}

/**
 * Fetch and persist history for the entire default universe.
 * Uses bounded concurrency to respect rate limits.
 */
export async function fetchUniverseData(
  symbols: string[] = [...DEFAULT_UNIVERSE_SYMBOLS],
  exchange: string = "NSE",
  lookbackDays: number = 400,
): Promise<{
  totalSymbols: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ symbol: string; error: string }>;
  durationMs: number;
}> {
  const startTime = Date.now();
  const concurrency = DATA_FRESHNESS_CONFIG.maxConcurrentFetches;
  const results: Array<{ symbol: string; error: string | null }> = [];

  // Process in batches with bounded concurrency
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (sym) => {
        // Delay between requests within a batch to avoid rate limiting
        await sleep(300);
        return fetchAndPersistHistory(sym, exchange, lookbackDays);
      }),
    );
    results.push(...batchResults);

    // Inter-batch delay
    if (i + concurrency < symbols.length) {
      await sleep(1000);
    }
  }

  const errors = results.filter((r) => r.error != null).map((r) => ({ symbol: r.symbol, error: r.error! }));
  const durationMs = Date.now() - startTime;

  // Log the fetch to StockDataFetchLog
  try {
    await prisma.stockDataFetchLog.create({
      data: {
        provider: "YAHOO",
        symbolCount: symbols.length,
        successCount: results.filter((r) => r.error == null).length,
        failureCount: errors.length,
        durationMs,
        errors: JSON.stringify(errors.slice(0, 50)), // Cap at 50 errors
      },
    });
  } catch (logError) {
    console.error("[marketData] Failed to log fetch:", logError);
  }

  return {
    totalSymbols: symbols.length,
    successCount: results.filter((r) => r.error == null).length,
    failureCount: errors.length,
    errors,
    durationMs,
  };
}

/**
 * Get candles for a symbol from the database.
 */
export async function getCandles(
  symbol: string,
  startDate?: Date,
  endDate?: Date,
  provider: string = "YAHOO",
): Promise<MarketBar[]> {
  const where: any = { symbol, provider, quality: "VALID" };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = startDate;
    if (endDate) where.date.lte = endDate;
  }

  const bars = await prisma.stockMarketBar.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return bars.map((b) => ({
    symbol: b.symbol,
    exchange: b.exchange,
    date: b.date.toISOString().split("T")[0],
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    adjustedClose: b.adjustedClose,
    volume: b.volume,
    provider: b.provider,
    retrievedAt: b.retrievedAt,
    quality: b.quality as DataQuality,
  }));
}

/**
 * Assess data freshness for a symbol.
 */
export async function assessFreshness(symbol: string): Promise<MarketDataFreshness> {
  const latest = await prisma.stockMarketBar.findFirst({
    where: { symbol, quality: "VALID" },
    orderBy: { date: "desc" },
    select: { date: true, close: true, retrievedAt: true },
  });

  if (!latest) {
    return {
      symbol,
      latestDate: null,
      latestClose: null,
      dataAgeHours: null,
      isFresh: false,
      quality: "MISSING",
    };
  }

  const now = new Date();
  const dataAgeHours = (now.getTime() - latest.retrievedAt.getTime()) / (1000 * 60 * 60);
  const isFresh = dataAgeHours <= DATA_FRESHNESS_CONFIG.maxDataAgeHours;

  return {
    symbol,
    latestDate: latest.date.toISOString().split("T")[0],
    latestClose: latest.close,
    dataAgeHours: Math.round(dataAgeHours * 10) / 10,
    isFresh,
    quality: isFresh ? "VALID" : "STALE",
  };
}

/**
 * Get provider health status.
 */
export async function getProviderHealth(): Promise<DataProviderStatus> {
  const lastSuccess = await prisma.stockDataFetchLog.findFirst({
    where: { provider: "YAHOO", failureCount: 0 },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true },
  });

  const lastFailed = await prisma.stockDataFetchLog.findFirst({
    where: { provider: "YAHOO", failureCount: { gt: 0 } },
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true, errors: true },
  });

  const recentLogs = await prisma.stockDataFetchLog.findMany({
    where: { provider: "YAHOO" },
    orderBy: { fetchedAt: "desc" },
    take: 5,
  });

  const consecutiveFailures = recentLogs.findIndex((l) => l.failureCount === 0);
  const isHealthy = consecutiveFailures === 0 || consecutiveFailures === -1 ? recentLogs.length === 0 : true;

  return {
    provider: "YAHOO",
    lastSuccessfulFetch: lastSuccess?.fetchedAt ?? null,
    lastFailedFetch: lastFailed?.fetchedAt ?? null,
    lastError: lastFailed?.errors ?? null,
    consecutiveFailures: consecutiveFailures === -1 ? recentLogs.length : consecutiveFailures,
    isHealthy,
  };
}

/**
 * Get the count of valid historical candles for a symbol.
 */
export async function getHistoryCount(symbol: string): Promise<number> {
  return prisma.stockMarketBar.count({
    where: { symbol, quality: "VALID" },
  });
}

export { getProviderHealth as getDataProviderStatus, assessFreshness as checkDataFreshness };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
