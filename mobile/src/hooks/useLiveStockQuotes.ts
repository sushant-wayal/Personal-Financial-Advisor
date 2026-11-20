import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { apiUrl } from "../lib/apiBaseUrl";

export interface MobileLiveStockQuote {
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

export interface MobileMarketStatus {
  isOpen: boolean;
  session: "REGULAR" | "PRE_OPEN" | "POST_CLOSE" | "CLOSED";
  dateStr: string;
  message: string;
  timeStr: string;
}

export function useLiveStockQuotes(symbols: string[] = []) {
  const normalizedSymbols = useMemo(() => {
    return Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))).sort();
  }, [symbols]);

  const symbolsKey = normalizedSymbols.join(",");

  const [quotes, setQuotes] = useState<Record<string, MobileLiveStockQuote>>({});
  const [marketStatus, setMarketStatus] = useState<MobileMarketStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const prevPricesRef = useRef<Record<string, number>>({});
  const tickDirectionsRef = useRef<Record<string, "UP" | "DOWN" | "SAME">>({});
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timerId: NodeJS.Timeout | null = null;

    async function fetchQuotes() {
      // Don't poll if app is in background
      if (appStateRef.current !== "active") {
        scheduleNext(10000);
        return;
      }

      try {
        const queryStr = normalizedSymbols.length > 0 ? `?symbols=${encodeURIComponent(symbolsKey)}` : "";
        const url = apiUrl(`/api/stocks/live/quotes${queryStr}`);

        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.ok) {
            const nextQuotes = json.quotes || {};
            const prev = prevPricesRef.current;
            const nextTicks: Record<string, "UP" | "DOWN" | "SAME"> = {};

            for (const [sym, q] of Object.entries<MobileLiveStockQuote>(nextQuotes)) {
              const oldPrice = prev[sym];
              if (oldPrice !== undefined && oldPrice !== q.price) {
                nextTicks[sym] = q.price > oldPrice ? "UP" : "DOWN";
              } else {
                nextTicks[sym] = "SAME";
              }
              prev[sym] = q.price;
            }

            tickDirectionsRef.current = nextTicks;
            setQuotes(nextQuotes);
            setMarketStatus(json.marketStatus);
            setLastUpdated(json.timestamp);
            setIsLoading(false);
            setIsError(false);

            // Adaptive polling interval based on market session
            const isOpen = json.marketStatus?.isOpen ?? false;
            scheduleNext(isOpen ? 4000 : 25000);
            return;
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn("[mobile:useLiveStockQuotes] Failed to fetch quotes:", err);
          setIsError(true);
        }
      }

      scheduleNext(10000);
    }

    function scheduleNext(ms: number) {
      if (timerId) clearTimeout(timerId);
      if (isMounted) {
        timerId = setTimeout(fetchQuotes, ms);
      }
    }

    fetchQuotes();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [symbolsKey, normalizedSymbols.length]);

  const getQuote = (symbol: string): MobileLiveStockQuote | undefined => {
    return quotes[symbol.trim().toUpperCase()];
  };

  const getTickDirection = (symbol: string): "UP" | "DOWN" | "SAME" => {
    return tickDirectionsRef.current[symbol.trim().toUpperCase()] || "SAME";
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
