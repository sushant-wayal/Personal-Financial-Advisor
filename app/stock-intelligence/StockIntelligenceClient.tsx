"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { calculateStockBrokerage, calculateStockCharges } from "@/src/services/shared";

import ReactMarkdown from "react-markdown";

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

function formatBindingConstraint(raw: string | null | undefined): string {
  if (!raw) return "Optimal Sizing";
  switch (raw) {
    case "cycle_stock_credit_limit":
      return "Sized from cycle stock credit";
    case "slot_tranche_allocated":
      return "Sized by available position slot capacity";
    case "market_regime_moderated":
      return "Moderated by market regime condition";
    case "drawdown_throttle_active":
      return "Scaled down by drawdown throttle";
    case "max_positions_reached":
      return "Max open positions (5/5) reached";
    case "cycle_budget_exhausted":
      return "Cycle credit exhausted";
    case "cash_capacity_limit":
      return "Sized by liquid cash";
    case "exposure_cap_limit":
      return "Portfolio exposure limit";
    case "zero_deployable_cash":
      return "Zero unallocated cash";
    case "phase_blocked_crisis":
      return "Paused: Crisis stabilization";
    case "regime_blocked_bearish":
      return "Paused: Bearish regime";
    case "regime_blocked_high_volatility":
      return "Paused: High volatility";
    case "drawdown_halt_triggered":
      return "Paused: 5% drawdown circuit breaker";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatPhaseName(raw: string | null | undefined): string {
  if (!raw) return "Wealth Building";
  switch (raw) {
    case "EF_BUILDING":
      return "Reserve Building";
    case "WEALTH_BUILDING":
      return "Wealth Building";
    case "GOAL_SPRINT":
      return "Goal Sprint";
    case "CRISIS":
      return "Crisis Mode";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatStatusName(raw: string | null | undefined): string {
  if (!raw) return "Active";
  switch (raw) {
    case "ACTIVE":
      return "Active";
    case "CYCLE_BUDGET_EXHAUSTED":
      return "Cycle Credit Used";
    case "EXPOSURE_CAP_REACHED":
      return "Exposure Capped";
    case "BLOCKED_BY_PHASE":
      return "Phase Protected";
    case "BLOCKED_BY_REGIME":
      return "Regime Paused";
    case "ZERO_SURPLUS":
      return "Zero Surplus";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export default function StockIntelligenceClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"recommendations" | "capital" | "paper" | "backtest">("recommendations");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Backtest form state
  const [backtestStrategy, setBacktestStrategy] = useState<StrategyName>("TREND_PULLBACK");
  const [backtestCapital, setBacktestCapital] = useState<number>(100000);
  const [backtestSlippage, setBacktestSlippage] = useState<number>(0.2);

  // Live stock investment confirmation dialog state
  const [investModalBuy, setInvestModalBuy] = useState<BuyRecommendation | null>(null);
  const [executedPriceInput, setExecutedPriceInput] = useState<string>("");
  const [executedQtyInput, setExecutedQtyInput] = useState<string>("");
  const [brokerageInput, setBrokerageInput] = useState<string>("20");

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
  const {
    data: capData,
    isLoading: isCapLoading,
    isError: isCapError,
    refetch: refetchCapital,
  } = useQuery<{
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
    onSuccess: (data: { ok?: boolean; isSessionLocked?: boolean; message?: string }) => {
      if (data?.isSessionLocked) {
        setStatusMessage({
          type: "info",
          text: data.message || "Today's daily recommendation plan is active with executed trades. Daily session plan is locked to prevent overtrading.",
        });
      } else {
        setStatusMessage({ type: "success", text: "Daily quantitative pipeline completed successfully!" });
      }
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

  // 7. Live / Cycle Stock Investment Mutation
  const investStockMutation = useMutation({
    mutationFn: async (payload: {
      itemId?: string;
      symbol: string;
      amount?: number;
      quantity?: number;
      executedPrice?: number;
      brokerage?: number;
      entryPrice?: number;
    }) => {
      const res = await fetch("/api/stock-intelligence/recommendations/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to record investment");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setStatusMessage({ type: "success", text: data.message || "Stock investment recorded successfully!" });
      setInvestModalBuy(null);
      void queryClient.invalidateQueries({ queryKey: ["stockCapitalAllocation"] });
      void queryClient.invalidateQueries({ queryKey: ["stockRecommendations"] });
      void queryClient.invalidateQueries({ queryKey: ["stockCapital"] });
      void queryClient.invalidateQueries({ queryKey: ["emergencyFundStatus"] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Stock investment error";
      setStatusMessage({ type: "error", text: msg });
      setTimeout(() => setStatusMessage(null), 6000);
    },
  });

  const handleOpenInvestModal = (buy: BuyRecommendation) => {
    setInvestModalBuy(buy);
    const initialPrice = buy.entryPrice ?? 0;
    const initialQty = buy.quantity ?? 1;
    setExecutedPriceInput(String(initialPrice || ""));
    setExecutedQtyInput(String(initialQty || 1));
    const autoBrokerage = calculateStockBrokerage(initialPrice * initialQty);
    setBrokerageInput(String(autoBrokerage || ""));
  };

  const parsedPrice = parseFloat(executedPriceInput) || 0;
  const parsedQty = parseInt(executedQtyInput, 10) || 0;
  const modalTradeValue = Math.round(parsedPrice * parsedQty * 100) / 100;
  const itemizedCharges = calculateStockCharges(modalTradeValue);
  const autoComputedBrokerage = itemizedCharges.totalCharges;
  const parsedBrokerage = brokerageInput !== "" ? (parseFloat(brokerageInput) || 0) : autoComputedBrokerage;
  const modalTotalDeducted = Math.round((modalTradeValue + parsedBrokerage) * 100) / 100;

  const handleConfirmInvestment = () => {
    if (!investModalBuy) return;
    if (parsedPrice <= 0 || parsedQty <= 0) return;
    investStockMutation.mutate({
      itemId: investModalBuy.id,
      symbol: investModalBuy.symbol,
      executedPrice: parsedPrice,
      quantity: parsedQty,
      brokerage: parsedBrokerage,
    });
  };

  // 8. Backtest Mutation
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
            {isCapLoading ? (
              <div className="h-8 w-28 animate-pulse rounded bg-muted" />
            ) : isCapError ? (
              <div className="flex items-center gap-1.5 text-xs text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Failed to load</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {formatInr(capital?.eligibleNewPurchaseBudget)}
                </div>
                <div className="mt-2 flex items-center">
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${
                    (capital?.eligibleNewPurchaseBudget ?? 0) > 0
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}>
                    {(capital?.eligibleNewPurchaseBudget ?? 0) > 0
                      ? "Ready for Deployment"
                      : formatStatusName(capital?.status)}
                  </span>
                </div>
              </>
            )}
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
              {formatPhaseName(capital?.financialPhase)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Direct-equity cap: {capital?.phaseMaxPct ?? 10}%
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
              <CardContent>
                <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-300">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2.5 space-y-1 text-slate-300">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2.5 space-y-1 text-slate-300">{children}</ol>,
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-cyan-300">{children}</strong>,
                      em: ({ children }) => <em className="italic text-emerald-300">{children}</em>,
                      h1: ({ children }) => <h1 className="text-base font-bold text-foreground mb-1.5">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">{children}</h3>,
                    }}
                  >
                    {run.aiExplanation}
                  </ReactMarkdown>
                </div>
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl font-bold text-foreground">{buy.symbol}</span>
                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                              BUY {buy.quantity} shares
                            </span>
                            {buy.status === "INVESTED" && (
                              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> INVESTED
                              </span>
                            )}
                            {buy.isAiDiscovered && (
                              <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI Scouted
                              </span>
                            )}
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

                      {/* Executed Live Position Banner if Invested */}
                      {buy.status === "INVESTED" && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-xs text-emerald-200">
                          <div className="font-semibold text-emerald-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Live Position Recorded
                            </span>
                            <span className="font-mono font-bold text-emerald-100">
                              Invested: ₹{formatDecimal(buy.investedAmount ?? ((buy.executedPrice ?? buy.entryPrice) * buy.quantity))}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-[11px] mt-1.5 flex items-center justify-between">
                            <span>
                              {buy.quantity} shares @ ₹{formatDecimal(buy.executedPrice ?? buy.entryPrice)}
                            </span>
                            <span>
                              Charges: ₹{formatDecimal(buy.brokerage ?? calculateStockBrokerage((buy.executedPrice ?? buy.entryPrice) * buy.quantity))} · Budget used: ₹{formatDecimal((buy.investedAmount ?? ((buy.executedPrice ?? buy.entryPrice) * buy.quantity)) + (buy.brokerage ?? calculateStockBrokerage((buy.executedPrice ?? buy.entryPrice) * buy.quantity)))}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* AI Catalyst Thesis if AI Scouted */}
                      {buy.aiThesis && (
                        <div className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-2.5 text-xs text-purple-200">
                          <div className="font-semibold text-purple-300 flex items-center gap-1.5 mb-1">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> AI Discovery Catalyst
                          </div>
                          <p className="leading-relaxed">{buy.aiThesis}</p>
                        </div>
                      )}

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

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
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
                          Simulate
                        </Button>
                        {buy.status === "INVESTED" ? (
                          <Button
                            size="sm"
                            disabled
                            className="bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-not-allowed opacity-90"
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                            Invested
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                            onClick={() => handleOpenInvestModal(buy)}
                            disabled={investStockMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1.5 h-3 w-3 text-white" />
                            Mark as Invested
                          </Button>
                        )}
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
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Capital Safeguards & Sizing Engine
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Multi-layer capital protection ensuring direct stock trading never compromises your living reserves or financial goals.
              </p>
            </div>
            {capital?.status && (
              <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
                capital.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}>
                {capital.status === "ACTIVE" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {formatStatusName(capital.status)}
              </span>
            )}
          </div>

          {isCapLoading ? (
            <div className="space-y-4 p-6 rounded-xl border border-border bg-card/60">
              <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-24 w-full animate-pulse rounded bg-muted" />
              <div className="h-24 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : isCapError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-300 flex items-center justify-between">
              <span>Unable to calculate capital allocation.</span>
              <Button variant="outline" size="sm" onClick={() => void refetchCapital()}>
                Retry Calculation
              </Button>
            </div>
          ) : (
            <>
              {capital?.statusReason && capital.status !== "ACTIVE" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-200">Policy Safeguard Notice: </span>
                    {capital.statusReason}
                  </div>
                </div>
              )}

              {/* 1. Cycle Stock Trading Allocation Card */}
              <Card className="border-border bg-card/60 backdrop-blur overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <Briefcase className="h-4 w-4 text-cyan-400" />
                        Cycle Stock Trading Allocation
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Direct-equity swing trading allocation configured for your financial phase and refreshed with each investment cycle.
                      </CardDescription>
                    </div>
                    <div className="text-right sm:self-auto shrink-0">
                      <span className="text-[11px] text-muted-foreground block uppercase font-medium">Bank Liquid Cash</span>
                      <span className="text-base font-bold text-foreground">{formatInr(capital?.verifiedLiquidCash)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Metric 1: Cycle Stock Pool */}
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
                          <span>Cycle Stock Trading Pool</span>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded font-medium">Monthly Credit</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground mt-2">{formatInr(capital?.cycleStockTradingPool)}</div>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-2 block">
                        Allocated during investment cycle run
                      </span>
                    </div>

                    {/* Metric 2: Utilized This Cycle */}
                    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-purple-400">
                          <span>Utilized / Invested</span>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-medium">Current Cycle</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground mt-2">
                          {formatInr(Math.max(0, (capital?.cycleStockTradingPool ?? 0) - (capital?.remainingCycleStockBalance ?? 0)))}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-2 block">
                        Committed in active stock trades
                      </span>
                    </div>

                    {/* Metric 3: Remaining Cycle Balance */}
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-col justify-between ring-1 ring-emerald-500/30">
                      <div>
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                          <span>Available Cycle Credit</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-medium">Deployable</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground mt-2">{formatInr(capital?.remainingCycleStockBalance)}</div>
                      </div>
                      <span className="text-[11px] text-emerald-300/80 mt-2 block font-medium">
                        Governs daily purchase sizing
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-foreground">Strict Cycle Ring-Fencing:</strong> Stock suggestions draw exclusively from your cycle stock trading credit. Emergency reserves, goals, and mutual fund SIPs are completely independent and protected from trading risk.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Portfolio Exposure & Phase Policy Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border bg-card/60 backdrop-blur p-4">
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">Financial Phase</span>
                  <div className="text-lg font-bold text-foreground mt-1">{formatPhaseName(capital?.financialPhase)}</div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">{capital?.phaseMaxPct}% Max Capital Cap</span>
                </Card>

                <Card className="border-border bg-card/60 backdrop-blur p-4">
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">Market Regime</span>
                  <div className="text-lg font-bold text-foreground mt-1">{capital?.marketRegime}</div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    {capital?.marketRegimeFactor ? Math.round(capital.marketRegimeFactor * 100) : 70}% Sizing Multiplier
                  </span>
                </Card>

                <Card className="border-border bg-card/60 backdrop-blur p-4">
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">Existing Holdings</span>
                  <div className="text-lg font-bold text-foreground mt-1">{formatInr(capital?.deployedCapital)}</div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">Counts toward exposure cap</span>
                </Card>

                <Card className="border-border bg-card/60 backdrop-blur p-4">
                  <span className="text-[11px] text-muted-foreground uppercase font-medium">Max Allowed Exposure</span>
                  <div className="text-lg font-bold text-cyan-400 mt-1">{formatInr(capital?.maxPermittedExposure)}</div>
                  <span className="text-xs text-muted-foreground mt-0.5 block">
                    Capacity: {formatInr(capital?.remainingExposureCapacity)}
                  </span>
                </Card>
              </div>

              {/* 3. Hero Trading Budget Sizing Result */}
              <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-background to-cyan-950/30 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Permitted Daily Trading Budget
                  </span>
                  <div className="text-3xl font-extrabold text-foreground mt-1">
                    {formatInr(capital?.eligibleNewPurchaseBudget)}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Governed by: <strong className="text-emerald-300 font-medium">{formatBindingConstraint(capital?.bindingConstraint)}</strong>
                  </span>
                </div>
                <div className="text-xs text-slate-300 max-w-sm border-l border-emerald-500/20 pl-4 space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Zero Margin & Leverage Policy
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Purchases are strictly funded from cycle stock trading credits. Never borrows or leverages personal accounts.
                  </p>
                </div>
              </div>

              {/* 4. Drawdown Circuit Breakers Grid */}
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-cyan-400" />
                  Drawdown Control Rules (Conservative 5% Target)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <span className="font-bold text-emerald-400 block">&lt; 3.0% Drawdown</span>
                    <span className="text-muted-foreground text-[11px] mt-1 block">Normal operation. All eligible swing strategies active.</span>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <span className="font-bold text-amber-400 block">3.0% – 4.0% Warning</span>
                    <span className="text-muted-foreground text-[11px] mt-1 block">Tighter position sizing. Momentum paused.</span>
                  </div>
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                    <span className="font-bold text-purple-400 block">4.0% – 4.5% Restricted</span>
                    <span className="text-muted-foreground text-[11px] mt-1 block">New purchases restricted. Existing positions managed.</span>
                  </div>
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                    <span className="font-bold text-rose-400 block">≥ 4.5% Circuit Breaker</span>
                    <span className="text-muted-foreground text-[11px] mt-1 block">Trading Halt. Zero new orders permitted until recovery.</span>
                  </div>
                </div>
              </div>
            </>
          )}
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

      {/* Live Investment Execution Confirmation Modal */}
      <Dialog
        open={!!investModalBuy}
        onOpenChange={(open) => {
          if (!open && !investStockMutation.isPending) {
            setInvestModalBuy(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              Record Stock Execution: {investModalBuy?.symbol}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Confirm your broker fill price and quantity. Delivery charges (brokerage, STT, stamp duty, exchange, SEBI, GST) are computed and deducted from your cycle stock budget.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="executed-price" className="text-xs text-muted-foreground">
                  Executed Price / Share (₹)
                </Label>
                <Input
                  id="executed-price"
                  type="number"
                  step="0.05"
                  min="0.01"
                  value={executedPriceInput}
                  onChange={(e) => setExecutedPriceInput(e.target.value)}
                  className="font-mono text-sm border-border bg-background px-3 py-2 rounded-md"
                  placeholder="343.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="executed-qty" className="text-xs text-muted-foreground">
                  Executed Quantity (Shares)
                </Label>
                <Input
                  id="executed-qty"
                  type="number"
                  step="1"
                  min="1"
                  value={executedQtyInput}
                  onChange={(e) => setExecutedQtyInput(e.target.value)}
                  className="font-mono text-sm border-border bg-background px-3 py-2 rounded-md"
                  placeholder="2"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="brokerage-fee" className="text-xs text-muted-foreground">
                  Brokerage & Total Charges (₹)
                </Label>
                <button
                  type="button"
                  onClick={() => setBrokerageInput(String(autoComputedBrokerage))}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono"
                >
                  Auto: ₹{formatDecimal(autoComputedBrokerage)}
                </button>
              </div>
              <Input
                id="brokerage-fee"
                type="number"
                step="0.01"
                min="0"
                value={brokerageInput}
                onChange={(e) => setBrokerageInput(e.target.value)}
                className="font-mono text-sm border-border bg-background px-3 py-2 rounded-md"
                placeholder={String(autoComputedBrokerage)}
              />
            </div>

            {/* Financial Deduction Breakdown Box */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Stock Trade Value ({parsedQty} × ₹{formatDecimal(parsedPrice)}):</span>
                <span className="font-mono text-foreground font-semibold">₹{formatDecimal(modalTradeValue)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Brokerage & Statutory Charges:</span>
                <span className="font-mono text-foreground font-semibold">+ ₹{formatDecimal(parsedBrokerage)}</span>
              </div>

              {/* Itemized Charges Sub-panel */}
              <div className="text-[11px] text-muted-foreground pl-2.5 space-y-0.5 border-l-2 border-border/70 py-0.5 my-1">
                <div className="flex justify-between">
                  <span>• Brokerage (max(₹5, min(0.001×Trade, ₹20))):</span>
                  <span className="font-mono text-foreground/80">₹{formatDecimal(itemizedCharges.brokerage)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• STT (0.001×Trade):</span>
                  <span className="font-mono text-foreground/80">₹{formatDecimal(itemizedCharges.stt)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Stamp Duty (0.00015×Trade):</span>
                  <span className="font-mono text-foreground/80">₹{formatDecimal(itemizedCharges.stampDuty)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Exchange & SEBI:</span>
                  <span className="font-mono text-foreground/80">₹{formatDecimal(itemizedCharges.exchangeCharges + itemizedCharges.sebiCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• GST (18% on fees):</span>
                  <span className="font-mono text-foreground/80">₹{formatDecimal(itemizedCharges.gst)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm">
                <span className="text-foreground">Cycle Stock Budget Used:</span>
                <span className="font-mono text-emerald-400">₹{formatDecimal(modalTotalDeducted)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1 leading-normal">
                Deducted from your monthly cycle stock budget. Bank account balance is not deducted here (money transfers to Groww are tracked via bank debits).
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInvestModalBuy(null)}
              disabled={investStockMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={handleConfirmInvestment}
              disabled={investStockMutation.isPending || parsedPrice <= 0 || parsedQty <= 0}
            >
              {investStockMutation.isPending ? "Recording..." : `Confirm Investment (₹${formatDecimal(modalTradeValue)} in shares)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
