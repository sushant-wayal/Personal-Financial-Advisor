"use client";

import React, { useEffect, useState, useRef } from "react";
import type { LiveStockQuote } from "@/src/services/marketData";

interface LiveStockTickerProps {
  quote?: LiveStockQuote;
  fallbackPrice?: number | null;
  showChange?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LiveStockTicker({
  quote,
  fallbackPrice,
  showChange = true,
  size = "md",
  className = "",
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
      }, 800);

      prevPriceRef.current = currentPrice;
      return () => {
        clearTimeout(triggerTimer);
        clearTimeout(resetTimer);
      };
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(currentPrice);

  const isPositive = (quote?.change ?? 0) >= 0;
  const changeFormatted = quote
    ? `${isPositive ? "+" : ""}${quote.change.toFixed(2)} (${isPositive ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
    : null;

  const sizeStyles = {
    sm: "text-sm",
    md: "text-base font-semibold",
    lg: "text-2xl font-bold tracking-tight",
  }[size];

  const flashClass =
    flash === "up"
      ? "bg-emerald-500/20 text-emerald-400 px-1 rounded transition-colors duration-300"
      : flash === "down"
      ? "bg-rose-500/20 text-rose-400 px-1 rounded transition-colors duration-300"
      : "transition-colors duration-500";

  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <span className={`font-mono font-bold ${sizeStyles} ${flashClass}`}>
        {formattedPrice}
      </span>
      {showChange && quote && (
        <span
          className={`text-xs font-mono font-medium flex items-center gap-0.5 ${
            isPositive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isPositive ? "▲" : "▼"} {changeFormatted}
        </span>
      )}
    </div>
  );
}

export function LiveMarketBadge({
  isOpen,
  session,
  message,
}: {
  isOpen?: boolean;
  session?: string;
  message?: string;
}) {
  if (isOpen) {
    return (
      <span
        title={message || "Indian Stock Market is Open (NSE/BSE)"}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        LIVE NSE
      </span>
    );
  }

  return (
    <span
      title={message || "Indian Stock Market is Closed"}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/60"
    >
      <span className="inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500"></span>
      {session === "PRE_OPEN" ? "PRE-OPEN" : "MARKET CLOSED"}
    </span>
  );
}
