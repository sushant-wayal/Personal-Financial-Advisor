"use client";

import { useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LiveStockQuote, MarketStatus } from "@/src/services/marketData";

export interface UseLiveStockQuotesResult {
  quotes: Record<string, LiveStockQuote>;
  getQuote: (symbol: string) => LiveStockQuote | undefined;
  getTickDirection: (symbol: string) => "UP" | "DOWN" | "SAME";
  marketStatus: MarketStatus | undefined;
  isLoading: boolean;
  isError: boolean;
  lastUpdated: string | undefined;
}

export function useLiveStockQuotes(symbols: string[] = []): UseLiveStockQuotesResult {
  // Normalize and memoize symbol list
  const normalizedSymbols = useMemo(() => {
    return Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))).sort();
  }, [symbols]);

  const symbolsKey = normalizedSymbols.join(",");

  // Keep track of previous prices to compute tick directions
  const previousPricesRef = useRef<Record<string, number>>({});
  const tickDirectionsRef = useRef<Record<string, "UP" | "DOWN" | "SAME">>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["liveStockQuotes", symbolsKey],
    queryFn: async () => {
      const queryStr = normalizedSymbols.length > 0 ? `?symbols=${encodeURIComponent(symbolsKey)}` : "";
      const res = await fetch(`/api/stocks/live/quotes${queryStr}`);
      if (!res.ok) {
        throw new Error("Failed to fetch live stock quotes");
      }
      return (await res.json()) as {
        ok: boolean;
        marketStatus: MarketStatus;
        quotes: Record<string, LiveStockQuote>;
        timestamp: string;
      };
    },
    refetchInterval: (query) => {
      const isOpen = query.state.data?.marketStatus?.isOpen ?? false;
      // 3.5 seconds when market is active; 20 seconds heartbeat when market is closed
      return isOpen ? 3500 : 20000;
    },
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });

  const quotes = data?.quotes || {};
  const marketStatus = data?.marketStatus;
  const lastUpdated = data?.timestamp;

  // Update tick directions whenever new quote data arrives
  useEffect(() => {
    if (!data?.quotes) return;

    const prev = previousPricesRef.current;
    const nextTicks: Record<string, "UP" | "DOWN" | "SAME"> = {};

    for (const [sym, quote] of Object.entries(data.quotes)) {
      const oldPrice = prev[sym];
      if (oldPrice !== undefined && oldPrice !== quote.price) {
        nextTicks[sym] = quote.price > oldPrice ? "UP" : "DOWN";
      } else {
        nextTicks[sym] = "SAME";
      }
      prev[sym] = quote.price;
    }

    tickDirectionsRef.current = nextTicks;
  }, [data?.quotes]);

  const getQuote = (symbol: string): LiveStockQuote | undefined => {
    const clean = symbol.trim().toUpperCase();
    return quotes[clean];
  };

  const getTickDirection = (symbol: string): "UP" | "DOWN" | "SAME" => {
    const clean = symbol.trim().toUpperCase();
    return tickDirectionsRef.current[clean] || "SAME";
  };

  return {
    quotes,
    getQuote,
    getTickDirection,
    marketStatus,
    isLoading,
    isError,
    lastUpdated,
  };
}
