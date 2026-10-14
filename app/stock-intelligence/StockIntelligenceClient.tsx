"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Sparkles,
  RefreshCw,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Layers,
  Database,
} from "lucide-react";
import type {
  RecommendationRun,
  BuyRecommendation,
  HoldRecommendation,
  SellRecommendation,
  PaperPortfolio,
  BacktestResult,
  CapitalAllocation,
  PortfolioRiskSnapshot,
} from "@/src/types/stockIntelligence";
import type { StrategyName } from "@/src/config/stockEngineDefaults";

function formatInr(val: number | null | undefined): string {
  if (val == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDecimal(val: number | null | undefined, digits = 2): string {
  if (val == null) return "0.00";
  return val.toFixed(digits);
}

export default function StockIntelligenceClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"recommendations" | "capital" | "paper" | "backtest">("recommendations");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Backtest form state
  const [backtestStrategy, setBacktestStrategy] = useState<StrategyName>("TREND_PULLBACK");
  const [backtestCapital, setBacktestCapital] = useState<number>(100000);
  const [backtestSlippage, setBacktestSlippage] = useState<number>(0.2);

  // 1. Fetch Recommendations Run
  const { data: recData } = useQuery<{ ok: boolean; run: RecommendationRun }>({
    queryKey: ["stockRecommendations"],
    queryFn: async () => {
      const res = await fetch("/api/stock-intelligence/recommendations");
      if (!res.ok) throw new Error("Failed to load recommendations");
      return res.json();
    },
  });

  // 2. Fetch Capital Allocation & Risk
  const { data: capData } = useQuery<{
    ok: boolean;
    capitalAllocation: CapitalAllocation;
    riskSnapshot: PortfolioRiskSnapshot;
    marketRegime: string;
  }>({
    queryKey: ["stockCapital"],
    queryFn: async () => {
      const res = await fetch("/api/stock-intelligence/capital");
      if (!res.ok) throw new Error("Failed to load capital allocation");
      return res.json();
    },
  });

  // 3. Fetch Paper Portfolio
  const { data: paperData } = useQuery<{ ok: boolean; portfolio: PaperPortfolio }>({
    queryKey: ["stockPaperPortfolio"],
    queryFn: async () => {
      const res = await fetch("/api/stock-intelligence/paper");
      if (!res.ok) throw new Error("Failed to load paper portfolio");
      return res.json();
    },
  });

  // 4. Trigger Pipeline Run Mutation
  const runPipelineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRerun: true }),
      });
      if (!res.ok) throw new Error("Pipeline run failed");
      return res.json();
    },
    onSuccess: () => {
      setStatusMessage({ type: "success", text: "Daily quantitative pipeline completed successfully!" });
      void queryClient.invalidateQueries({ queryKey: ["stockRecommendations"] });
      void queryClient.invalidateQueries({ queryKey: ["stockCapital"] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error running pipeline";
      setStatusMessage({ type: "error", text: msg });
      setTimeout(() => setStatusMessage(null), 6000);
    },
  });

  // 5. Market Data Sync Mutation
  const syncDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock-intelligence/sync-data", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Data synchronization failed");
      return res.json();
    },
    onSuccess: (data) => {
      const count = data?.result?.persisted ?? 0;
      setStatusMessage({ type: "success", text: `Synchronized ${count} market candles from Yahoo Finance (₹0 budget).` });
      void queryClient.invalidateQueries({ queryKey: ["stockRecommendations"] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Data sync error";
      setStatusMessage({ type: "error", text: msg });
      setTimeout(() => setStatusMessage(null), 6000);
    },
  });

  // 6. Paper Trading Order Mutations
  const paperOrderMutation = useMutation({
    mutationFn: async (payload: { action: "BUY" | "SELL" | "SYNC" | "RESET"; [key: string]: unknown }) => {
      const res = await fetch("/api/stock-intelligence/paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Paper trade operation failed");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      const actionText = vars.action === "BUY"
        ? "Simulated paper buy order executed!"
        : vars.action === "SELL"
          ? "Paper trade closed successfully!"
          : vars.action === "SYNC"
            ? "Paper portfolio marked-to-market with latest prices!"
            : "Paper sandbox reset to initial cash.";
      setStatusMessage({ type: "success", text: actionText });
      void queryClient.invalidateQueries({ queryKey: ["stockPaperPortfolio"] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Paper trade error";
      setStatusMessage({ type: "error", text: msg });
      setTimeout(() => setStatusMessage(null), 6000);
    },
  });

  // 7. Backtest Mutation
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const runBacktestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/stock-intelligence/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyName: backtestStrategy,
          initialCapital: backtestCapital,
          slippagePct: backtestSlippage,
        }),
      });
      if (!res.ok) throw new Error("Backtest simulation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setBacktestResult(data.result);
      setStatusMessage({ type: "success", text: `Backtest completed for ${backtestStrategy}!` });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Backtest execution error";
      setStatusMessage({ type: "error", text: msg });
      setTimeout(() => setStatusMessage(null), 6000);
    },
  });

  const run = recData?.run;
  const capital = capData?.capitalAllocation;
  const risk = capData?.riskSnapshot;
  const paper = paperData?.portfolio;

  const buys = (run?.recommendations?.filter((r) => r.type === "BUY") ?? []) as BuyRecommendation[];
  const holds = (run?.recommendations?.filter((r) => r.type === "HOLD") ?? []) as HoldRecommendation[];
  const sells = (run?.recommendations?.filter((r) => r.type === "SELL") ?? []) as SellRecommendation[];

  const regime = run?.marketRegime || capData?.marketRegime || "NEUTRAL";
  const regimeColor = regime === "BULLISH"
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
    : regime === "BEARISH"
      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
      : regime === "HIGH_VOLATILITY"
        ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
        : "bg-amber-500/10 text-amber-400 border-amber-500/30";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Banner Status Notification */}
      {statusMessage && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm backdrop-blur transition-all ${statusMessage.type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : statusMessage.type === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
            }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : statusMessage.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          ) : (
            <Sparkles className="h-5 w-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-400 border border-cyan-500/20">
              Indian Cash Equity (NSE)
            </span>
            <span className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider border ${regimeColor}`}>
              Regime: {regime}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            North Stock Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personalized quantitative swing trading engine (2–15 day horizon) with ₹0 market-data budget and strict 5% drawdown safety limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncDataMutation.mutate()}
            disabled={syncDataMutation.isPending}
            className="border-border hover:bg-muted/60"
          >
            <Database className={`mr-2 h-4 w-4 ${syncDataMutation.isPending ? "animate-spin text-cyan-400" : ""}`} />
            {syncDataMutation.isPending ? "Syncing..." : "Sync Candles"}
          </Button>

          <Button
            size="sm"
            onClick={() => runPipelineMutation.mutate()}
            disabled={runPipelineMutation.isPending}
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 font-semibold text-slate-950 hover:from-cyan-400 hover:to-emerald-400"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${runPipelineMutation.isPending ? "animate-spin" : ""}`} />
            {runPipelineMutation.isPending ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Safe Deployable Capital */}
        <Card className="border-border bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Safe Trading Budget
            </CardTitle>
            <Briefcase className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatInr(capital?.eligibleNewPurchaseBudget ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Binding: <span className="text-emerald-400 font-medium">{capital?.bindingConstraint || "Calculated safe"}</span>
            </p>
          </CardContent>
        </Card>

        {/* Drawdown Gauge */}
        <Card className="border-border bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Drawdown Control
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {formatDecimal(risk?.drawdownPct ?? 0, 1)}%
              </span>
              <span className="text-xs text-muted-foreground">/ 5.0% target</span>
            </div>
            {/* Drawdown progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${(risk?.drawdownPct ?? 0) >= 4.0 ? "bg-rose-500" : (risk?.drawdownPct ?? 0) >= 3.0 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(100, ((risk?.drawdownPct ?? 0) / 5.0) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Phase */}
        <Card className="border-border bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Financial Phase
            </CardTitle>
            <Layers className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {capital?.financialPhase ?? "WEALTH_BUILDING"}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Emergency fund & commitments protected
            </p>
          </CardContent>
        </Card>

        {/* Paper Sandbox Equity */}
        <Card className="border-border bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Paper Sandbox Equity
            </CardTitle>
            <Activity className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatInr(paper?.totalEquity ?? 100000)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Win Rate: <span className="text-foreground font-semibold">{paper?.winRate ?? 0}%</span> ({paper?.tradeCount ?? 0} trades)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("recommendations")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "recommendations"
            ? "border-cyan-400 text-cyan-400"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Sparkles className="h-4 w-4" />
          Daily Recommendations ({buys.length + holds.length + sells.length})
        </button>

        <button
          onClick={() => setActiveTab("capital")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "capital"
            ? "border-cyan-400 text-cyan-400"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Capital Safeguards & Risk
        </button>

        <button
          onClick={() => setActiveTab("paper")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "paper"
            ? "border-cyan-400 text-cyan-400"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Activity className="h-4 w-4" />
          Paper Trading Sandbox ({paper?.positions?.length ?? 0})
        </button>

        <button
          onClick={() => setActiveTab("backtest")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === "backtest"
            ? "border-cyan-400 text-cyan-400"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Play className="h-4 w-4" />
          Historical Backtester
        </button>
      </div>

      {/* ───────────────── TAB 1: RECOMMENDATIONS ───────────────── */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          {/* AI Executive Briefing Card */}
          {run?.aiExplanation && (
            <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-background to-emerald-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-400" />
                  <CardTitle className="text-base font-semibold text-foreground">
                    AI Advisor Executive Briefing
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {run.aiExplanation}
              </CardContent>
            </Card>
          )}

          {/* BUY RECOMMENDATIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                  {buys.length}
                </span>
                Buy Recommendations (Delivery Cash Equity)
              </h2>
              <span className="text-xs text-muted-foreground">
                Max 3 high-conviction ideas / day
              </span>
            </div>

            {buys.length === 0 ? (
              <Card className="border-border bg-card/40 p-8 text-center">
                <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground/60" />
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  Capital Preservation Active — Zero Purchases Forced
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Today&apos;s quantitative scan found no eligible Indian stocks meeting our conservative risk-adjusted criteria or your financial phase limits.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {buys.map((buy) => (
                  <Card key={buy.symbol} className="border-emerald-500/30 bg-card/80 backdrop-blur">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-foreground">{buy.symbol}</span>
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                              BUY {buy.quantity} shares
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {buy.exchange}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Strategy: <span className="text-foreground font-medium">{buy.strategy}</span> · Horizon: ~{buy.expectedHoldingDays} days
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground">
                            ₹{formatDecimal(buy.entryPrice)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Est: {formatInr(buy.estimatedCapital)}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {/* Entry, Stop, Target Strip */}
                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center text-xs">
                        <div>
                          <div className="text-muted-foreground">Entry Condition</div>
                          <div className="font-semibold text-foreground mt-0.5">
                            ≤ ₹{formatDecimal(buy.maxChasePrice)}
                          </div>
                        </div>
                        <div>
                          <div className="text-rose-400">ATR Stop Loss</div>
                          <div className="font-semibold text-rose-400 mt-0.5">
                            ₹{formatDecimal(buy.stopLoss)}
                          </div>
                        </div>
                        <div>
                          <div className="text-emerald-400">Profit Target</div>
                          <div className="font-semibold text-emerald-400 mt-0.5">
                            ₹{formatDecimal(buy.targetPrice)}
                          </div>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Quantitative Thesis
                        </div>
                        <ul className="mt-1 space-y-1 text-xs text-foreground/90">
                          {buy.reasonsFor.map((r, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-400">✓</span> {r}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Simulation Button */}
                      <div className="pt-2 border-t border-border flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => {
                            paperOrderMutation.mutate({
                              action: "BUY",
                              symbol: buy.symbol,
                              exchange: buy.exchange,
                              strategy: buy.strategy,
                              quantity: buy.quantity,
                              entryPrice: buy.entryPrice,
                              stopLoss: buy.stopLoss,
                              targetPrice: buy.targetPrice,
                            });
                          }}
                          disabled={paperOrderMutation.isPending}
                        >
                          <Play className="mr-1.5 h-3 w-3 text-cyan-400" />
                          Simulate in Paper Sandbox
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* HOLD RECOMMENDATIONS */}
          {holds.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                  {holds.length}
                </span>
                Hold Recommendations (Active Positions)
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {holds.map((hold) => (
                  <Card key={hold.symbol} className="border-border bg-card/60 backdrop-blur">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{hold.symbol}</span>
                        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
                          HOLD
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quantity:</span>
                        <span className="font-medium text-foreground">{hold.quantity} shares</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latest Price:</span>
                        <span className="font-medium text-foreground">₹{formatDecimal(hold.latestPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Unrealized P&L:</span>
                        <span className={`font-semibold ${hold.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {hold.unrealizedPnl >= 0 ? "+" : ""}{formatInr(hold.unrealizedPnl)} ({hold.unrealizedPnlPct}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Updated Stop:</span>
                        <span className="font-medium text-rose-400">₹{formatDecimal(hold.updatedStopLoss)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* SELL RECOMMENDATIONS */}
          {sells.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/20 text-xs font-bold text-rose-400">
                  {sells.length}
                </span>
                Sell Recommendations (Exit Triggers)
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sells.map((sell) => (
                  <Card key={sell.symbol} className="border-rose-500/30 bg-card/60 backdrop-blur">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{sell.symbol}</span>
                        <span className="rounded bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
                          SELL ({sell.urgency})
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="text-rose-300 font-medium">{sell.reason}</div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Trigger:</span>
                        <span className="font-medium text-foreground">{sell.trigger}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Estimated Realized P&L:</span>
                        <span className="font-medium text-foreground">{formatInr(sell.realizedPnlEstimate)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────── TAB 2: CAPITAL SAFEGUARDS ───────────────── */}
      {activeTab === "capital" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                Verified Personal Finance Capital Allocation Model
              </CardTitle>
              <CardDescription>
                Direct stock investments are strictly sized from verified deployable liquidity after protecting emergency reserves, living expenses, and financial commitments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-lg bg-muted/40 p-4 text-sm">
                <div className="flex justify-between font-medium">
                  <span>1. Verified Bank Cash Balance:</span>
                  <span className="text-foreground">{formatInr(capital?.verifiedLiquidCash)}</span>
                </div>
                {capital?.deductions?.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs text-rose-400">
                    <span>− Less: {d.label}:</span>
                    <span>−{formatInr(d.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Potentially Deployable Cash:</span>
                  <span className="text-cyan-400">{formatInr(capital?.potentiallyDeployableCash)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Phase Cap ({capital?.financialPhase}):</span>
                  <span>{capital?.phaseMaxPct}% limit ({formatInr(capital?.phaseLimitedCapital)})</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-base font-bold text-emerald-400">
                  <span>Final Permitted Daily Trading Budget:</span>
                  <span>{formatInr(capital?.eligibleNewPurchaseBudget)}</span>
                </div>
              </div>

              {/* Safety Halt Policy */}
              <div className="rounded-lg border border-border p-4 text-xs space-y-2 text-muted-foreground">
                <div className="text-foreground font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-cyan-400" />
                  Drawdown Control Rules (Conservative 5% Target)
                </div>
                <p>• <strong>&lt; 3.0%</strong>: Normal operation. All eligible strategies permitted.</p>
                <p>• <strong>3.0% – 4.0%</strong>: Warning zone. Position sizing tightened.</p>
                <p>• <strong>4.0% – 4.5%</strong>: Restricted zone. Momentum strategies disabled; existing positions only.</p>
                <p>• <strong>≥ 4.5%</strong>: Trading Halt. Zero new purchases permitted until recovery below 2.0%.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ───────────────── TAB 3: PAPER TRADING SANDBOX ───────────────── */}
      {activeTab === "paper" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Virtual Paper Trading Sandbox
              </h2>
              <p className="text-xs text-muted-foreground">
                Simulated execution with realistic Indian transaction costs (STT, brokerage, SEBI, GST). Completely isolated from your real bank balance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => paperOrderMutation.mutate({ action: "SYNC" })}
                disabled={paperOrderMutation.isPending}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${paperOrderMutation.isPending ? "animate-spin" : ""}`} />
                Mark to Market
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => paperOrderMutation.mutate({ action: "RESET" })}
                disabled={paperOrderMutation.isPending}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reset (₹1 Lakh)
              </Button>
            </div>
          </div>

          {/* Open Positions Table */}
          <Card className="border-border bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                Open Simulated Positions ({paper?.positions?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paper?.positions?.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No active paper positions. Execute simulated orders from the Daily Recommendations tab.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground uppercase">
                        <th className="pb-2">Symbol</th>
                        <th className="pb-2">Strategy</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Entry Price</th>
                        <th className="pb-2">Stop Loss</th>
                        <th className="pb-2">Target</th>
                        <th className="pb-2">Unrealized P&L</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paper?.positions?.map((pos) => (
                        <tr key={pos.id} className="hover:bg-muted/30">
                          <td className="py-2.5 font-bold text-foreground">{pos.symbol}</td>
                          <td className="py-2.5 text-muted-foreground">{pos.strategy}</td>
                          <td className="py-2.5 font-medium">{pos.quantity}</td>
                          <td className="py-2.5">₹{formatDecimal(pos.entryPrice)}</td>
                          <td className="py-2.5 text-rose-400">₹{formatDecimal(pos.stopLoss)}</td>
                          <td className="py-2.5 text-emerald-400">₹{formatDecimal(pos.targetPrice)}</td>
                          <td className={`py-2.5 font-semibold ${pos.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {pos.pnl >= 0 ? "+" : ""}{formatInr(pos.pnl)} ({pos.pnlPct}%)
                          </td>
                          <td className="py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={() => {
                                paperOrderMutation.mutate({
                                  action: "SELL",
                                  tradeId: pos.id,
                                  exitPrice: pos.entryPrice * (1 + (pos.pnlPct / 100)),
                                  exitReason: "MANUAL_CLOSE",
                                });
                              }}
                              disabled={paperOrderMutation.isPending}
                            >
                              Close
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ───────────────── TAB 4: BACKTESTING ───────────────── */}
      {activeTab === "backtest" && (
        <div className="space-y-6">
          <Card className="border-border bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">
                Historical Strategy Backtester (Walk-Forward, No Lookahead Bias)
              </CardTitle>
              <CardDescription>
                Simulates execution on Next-Session Open with 0.2% slippage, Indian statutory transaction taxes, whole shares, and conservative risk limits.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Strategy</label>
                  <select
                    value={backtestStrategy}
                    onChange={(e) => setBacktestStrategy(e.target.value as StrategyName)}
                    className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="TREND_PULLBACK">TREND_PULLBACK (Pullback in Uptrend)</option>
                    <option value="MOMENTUM">MOMENTUM (Breakout Continuation)</option>
                    <option value="RELATIVE_STRENGTH">RELATIVE_STRENGTH (Nifty Alpha)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Initial Capital (₹)</label>
                  <input
                    type="number"
                    value={backtestCapital}
                    onChange={(e) => setBacktestCapital(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase">Slippage (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={backtestSlippage}
                    onChange={(e) => setBacktestSlippage(Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <Button
                onClick={() => runBacktestMutation.mutate()}
                disabled={runBacktestMutation.isPending}
                className="bg-cyan-500 font-semibold text-slate-950 hover:bg-cyan-400"
              >
                <Play className={`mr-2 h-4 w-4 ${runBacktestMutation.isPending ? "animate-spin" : ""}`} />
                {runBacktestMutation.isPending ? "Simulating..." : "Run Backtest"}
              </Button>

              {/* Backtest Results Display */}
              {backtestResult && (
                <div className="mt-6 space-y-4 border-t border-border pt-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-xs text-muted-foreground">Cumulative Return</div>
                      <div className={`text-lg font-bold ${backtestResult.cumulativeReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {backtestResult.cumulativeReturn >= 0 ? "+" : ""}{backtestResult.cumulativeReturn}%
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-xs text-muted-foreground">Max Drawdown</div>
                      <div className="text-lg font-bold text-rose-400">
                        {backtestResult.maxDrawdown}%
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                      <div className="text-lg font-bold text-foreground">
                        {backtestResult.winRate}% ({backtestResult.totalTrades} trades)
                      </div>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="text-xs text-muted-foreground">Profit Factor</div>
                      <div className="text-lg font-bold text-cyan-400">
                        {backtestResult.profitFactor}
                      </div>
                    </div>
                  </div>

                  {/* Documented Limitations */}
                  <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground">Documented Backtest Limitations:</div>
                    {backtestResult.limitations.map((lim, idx) => (
                      <div key={idx}>• {lim}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
