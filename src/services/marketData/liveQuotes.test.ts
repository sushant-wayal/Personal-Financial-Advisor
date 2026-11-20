// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getExchangeMarketStatus,
  toYahooQuoteSymbol,
  fromYahooQuoteSymbol,
  fetchLiveQuotes,
  clearLiveQuoteCache,
} from "./liveQuotes";

describe("liveQuotes service", () => {
  beforeEach(() => {
    clearLiveQuoteCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Symbol formatting", () => {
    it("converts base symbol to Yahoo NSE symbol", () => {
      expect(toYahooQuoteSymbol("RELIANCE")).toBe("RELIANCE.NS");
      expect(toYahooQuoteSymbol("tcs")).toBe("TCS.NS");
      expect(toYahooQuoteSymbol("INFY", "BSE")).toBe("INFY.BO");
      expect(toYahooQuoteSymbol("HDFCBANK.NS")).toBe("HDFCBANK.NS");
    });

    it("extracts base ticker from Yahoo symbol", () => {
      expect(fromYahooQuoteSymbol("RELIANCE.NS")).toBe("RELIANCE");
      expect(fromYahooQuoteSymbol("INFY.BO")).toBe("INFY");
      expect(fromYahooQuoteSymbol("AAPL")).toBe("AAPL");
    });
  });

  describe("Market session status", () => {
    it("detects Sunday as market closed", () => {
      // 2026-03-01 is Sunday
      const sunday = new Date("2026-03-01T06:00:00Z"); // 11:30 AM IST
      const status = getExchangeMarketStatus(sunday);
      expect(status.isOpen).toBe(false);
      expect(status.session).toBe("CLOSED");
      expect(status.message).toContain("Sunday");
    });

    it("detects Republic Day holiday as market closed", () => {
      // 2026-01-26 is Republic Day
      const holiday = new Date("2026-01-26T06:00:00Z"); // 11:30 AM IST
      const status = getExchangeMarketStatus(holiday);
      expect(status.isOpen).toBe(false);
      expect(status.session).toBe("CLOSED");
      expect(status.message).toContain("Republic Day");
    });

    it("detects regular trading hours on a normal weekday", () => {
      // 2026-03-04 is Wednesday (Holi in 2026 is March 4, let's pick 2026-03-05 Thursday)
      // 06:00 UTC = 11:30 AM IST (within 09:15 - 15:30)
      const openTradingTime = new Date("2026-03-05T06:00:00Z");
      const status = getExchangeMarketStatus(openTradingTime);
      expect(status.isOpen).toBe(true);
      expect(status.session).toBe("REGULAR");
      expect(status.message).toContain("Live NSE");
    });

    it("detects pre-open session (09:00 - 09:15 AM IST)", () => {
      // 03:35 UTC = 09:05 AM IST
      const preOpenTime = new Date("2026-03-05T03:35:00Z");
      const status = getExchangeMarketStatus(preOpenTime);
      expect(status.isOpen).toBe(false);
      expect(status.session).toBe("PRE_OPEN");
    });

    it("detects post-close session (15:30 - 16:00 PM IST)", () => {
      // 10:15 UTC = 15:45 PM IST
      const postCloseTime = new Date("2026-03-05T10:15:00Z");
      const status = getExchangeMarketStatus(postCloseTime);
      expect(status.isOpen).toBe(false);
      expect(status.session).toBe("POST_CLOSE");
    });
  });

  describe("fetchLiveQuotes", () => {
    it("returns empty object when no symbols provided", async () => {
      const res = await fetchLiveQuotes([]);
      expect(res).toEqual({});
    });

    it("fetches and normalizes batch quotes from Yahoo Finance", async () => {
      const mockQuoteResponse = {
        quoteResponse: {
          result: [
            {
              symbol: "RELIANCE.NS",
              regularMarketPrice: 2850.5,
              regularMarketChange: 25.5,
              regularMarketChangePercent: 0.9,
              regularMarketDayHigh: 2865.0,
              regularMarketDayLow: 2820.0,
              regularMarketPreviousClose: 2825.0,
              regularMarketVolume: 4500000,
            },
            {
              symbol: "TCS.NS",
              regularMarketPrice: 3950.0,
              regularMarketChange: -12.0,
              regularMarketChangePercent: -0.3,
              regularMarketDayHigh: 3980.0,
              regularMarketDayLow: 3935.0,
              regularMarketPreviousClose: 3962.0,
              regularMarketVolume: 1200000,
            },
          ],
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuoteResponse,
      } as any);

      const quotes = await fetchLiveQuotes(["RELIANCE", "TCS"]);

      expect(quotes["RELIANCE"]).toBeDefined();
      expect(quotes["RELIANCE"].price).toBe(2850.5);
      expect(quotes["RELIANCE"].change).toBe(25.5);
      expect(quotes["RELIANCE"].changePercent).toBe(0.9);
      expect(quotes["TCS"].price).toBe(3950);

      // Verify second call is served from in-memory cache without another network fetch
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const cachedQuotes = await fetchLiveQuotes(["RELIANCE"]);
      expect(cachedQuotes["RELIANCE"].price).toBe(2850.5);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("falls back to chart endpoint if batch quote is missing an item", async () => {
      // First call (batch quote) returns empty result
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ quoteResponse: { result: [] } }),
        } as any)
        // Second call (fallback chart API) returns chart meta
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            chart: {
              result: [
                {
                  meta: {
                    regularMarketPrice: 1540.25,
                    chartPreviousClose: 1520.0,
                    regularMarketDayHigh: 1550.0,
                    regularMarketDayLow: 1515.0,
                  },
                },
              ],
            },
          }),
        } as any);

      const quotes = await fetchLiveQuotes(["INFY"]);
      expect(quotes["INFY"]).toBeDefined();
      expect(quotes["INFY"].price).toBe(1540.25);
      expect(quotes["INFY"].change).toBe(20.25);
    });
  });
});
