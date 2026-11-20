import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { MobileLiveStockQuote } from "../hooks/useLiveStockQuotes";
import { formatCurrencyAmount } from "../providers/CurrencyProvider";

interface LiveStockTickerProps {
  quote?: MobileLiveStockQuote;
  fallbackPrice?: number | null;
  showChange?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LiveStockTicker({
  quote,
  fallbackPrice,
  showChange = true,
  size = "md",
}: LiveStockTickerProps) {
  const currentPrice = quote?.price ?? fallbackPrice ?? 0;
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevPriceRef.current !== null && prevPriceRef.current > 0 && prevPriceRef.current !== currentPrice) {
      const direction = currentPrice > prevPriceRef.current ? "up" : "down";
      const triggerTimer = setTimeout(() => {
        setFlash(direction);
      }, 0);
      const resetTimer = setTimeout(() => {
        setFlash(null);
      }, 900);

      prevPriceRef.current = currentPrice;
      return () => {
        clearTimeout(triggerTimer);
        clearTimeout(resetTimer);
      };
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const isPositive = (quote?.change ?? 0) >= 0;
  const changeFormatted = quote
    ? `${isPositive ? "+" : ""}${quote.change.toFixed(2)} (${isPositive ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
    : null;

  const fontSizes = {
    sm: { price: 14, change: 11 },
    md: { price: 17, change: 12 },
    lg: { price: 24, change: 13 },
  }[size];

  const flashStyle =
    flash === "up"
      ? styles.flashUp
      : flash === "down"
      ? styles.flashDown
      : null;

  const textFlashColor =
    flash === "up"
      ? styles.textUp
      : flash === "down"
      ? styles.textDown
      : null;

  return (
    <View style={styles.container}>
      <View style={[styles.priceBox, flashStyle]}>
        <Text
          style={[
            styles.priceText,
            { fontSize: fontSizes.price },
            textFlashColor,
          ]}
        >
          {formatCurrencyAmount(currentPrice, "INR")}
        </Text>
      </View>
      {showChange && quote && (
        <Text
          style={[
            styles.changeText,
            { fontSize: fontSizes.change },
            isPositive ? styles.positiveText : styles.negativeText,
          ]}
        >
          {isPositive ? "▲" : "▼"} {changeFormatted}
        </Text>
      )}
    </View>
  );
}

export function LiveMarketBadge({
  isOpen,
  session,
}: {
  isOpen?: boolean;
  session?: string;
}) {
  if (isOpen) {
    return (
      <View style={[styles.badge, styles.liveBadge]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE NSE</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, styles.closedBadge]}>
      <View style={styles.closedDot} />
      <Text style={styles.closedText}>
        {session === "PRE_OPEN" ? "PRE-OPEN" : "MARKET CLOSED"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
  },
  priceBox: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  flashUp: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
  },
  flashDown: {
    backgroundColor: "rgba(244, 63, 94, 0.25)",
  },
  priceText: {
    fontWeight: "700",
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
  },
  textUp: {
    color: "#34d399",
  },
  textDown: {
    color: "#fb7185",
  },
  changeText: {
    fontWeight: "600",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  positiveText: {
    color: "#34d399",
  },
  negativeText: {
    color: "#fb7185",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  closedBadge: {
    backgroundColor: "rgba(63, 63, 70, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(82, 82, 91, 0.4)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34d399",
    marginRight: 6,
  },
  closedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#a1a1aa",
    marginRight: 6,
  },
  liveText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  closedText: {
    color: "#a1a1aa",
    fontSize: 11,
    fontWeight: "500",
  },
});
