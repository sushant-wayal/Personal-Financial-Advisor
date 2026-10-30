"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Layers,
  TrendingUp,
  DollarSign,
  Calendar,
  ShieldCheck,
  Building,
  ExternalLink,
  Info,
} from "lucide-react";
import type { IpoRunResult, IpoRecommendationItemData, IpoDetails } from "@/src/services/ipoData/types";
import ReactMarkdown from "react-markdown";

function formatInr(val: number | null | undefined): string {
  if (val == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function getVerdictBadge(verdict: string) {
  switch (verdict) {
    case "STRONG_APPLY":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "APPLY":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "NEUTRAL":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "AVOID":
    case "AVOID_ALL":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
  }
}

export default function IpoIntelligenceClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"open" | "upcoming" | "applications">("open");
  const [appliedModalIpo, setAppliedModalIpo] = useState<IpoRecommendationItemData | null>(null);
  const [lotCount, setLotCount] = useState(1);
  const [upiId, setUpiId] = useState("");
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);

  // 1. Fetch Today's Recommendation Run
  const { data: recData, isFetching: recFetching } = useQuery<{
    ok: boolean;
    run: IpoRunResult;
  }>({
    queryKey: ["ipo-recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/ipo-intelligence/recommendations");
      if (!res.ok) throw new Error("Failed to load IPO recommendations");
      return res.json();
    },
  });

  // 2. Fetch User Applications
  const { data: appData } = useQuery<{
    ok: boolean;
    applications: any[];
  }>({
    queryKey: ["ipo-applications"],
    queryFn: async () => {
      const res = await fetch("/api/ipo-intelligence/apply");
      if (!res.ok) throw new Error("Failed to load applications");
      return res.json();
    },
  });

  // 3. Trigger / Refresh Pipeline
  const runMutation = useMutation({
    mutationFn: async (forceRerun: boolean) => {
      const res = await fetch("/api/ipo-intelligence/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRerun }),
      });
      if (!res.ok) throw new Error("Failed to execute IPO recommendation pipeline");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo-recommendations"] });
      void queryClient.invalidateQueries({ queryKey: ["ipo-applications"] });
    },
  });

  // 4. Record Application Mutation
  const applyMutation = useMutation({
    mutationFn: async (payload: { symbol: string; lotsApplied: number; upiIdUsed: string }) => {
      const res = await fetch("/api/ipo-intelligence/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to record application");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ipo-applications"] });
      setApplySuccessMsg("Application recorded successfully in your tracker!");
      setTimeout(() => {
        setAppliedModalIpo(null);
        setApplySuccessMsg(null);
      }, 1500);
    },
  });

  const run = recData?.run;
  const bestPick = run?.bestPick;
  const openIpos = run?.openIpos ?? [];
  const upcomingIpos = run?.upcomingIpos ?? [];
  const userApplications = appData?.applications ?? [];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 pb-24 max-w-7xl mx-auto">
      {/* Top Header & Session Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Layers className="h-7 w-7 text-emerald-400" />
              IPO Intelligence
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              Primary Market
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Institutional-grade IPO discovery, Grey Market Premium tracking, and personalized application sizing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {run && (
            <div className="hidden sm:flex flex-col text-right text-xs">
              <span className="text-muted-foreground">Market Session (IST)</span>
              <span className="font-semibold text-foreground">{run.sessionDate}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => runMutation.mutate(true)}
            disabled={runMutation.isPending || recFetching}
            className="gap-2 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            {runMutation.isPending || recFetching ? (
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
            ) : (
              <Play className="h-4 w-4 text-emerald-400" />
            )}
            <span>Refresh Pipeline</span>
          </Button>
        </div>
      </div>

      {/* Capital & Financial Guardrails Overview */}
      {run?.personalBudget && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Deployable Surplus</p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {formatInr(run.personalBudget.deployableBudget)}
                </p>
              </div>
              <DollarSign className="h-7 w-7 text-emerald-400 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Financial Phase</p>
                <p className="text-xl font-bold text-foreground mt-0.5">
                  {run.personalBudget.financialPhase.replace(/_/g, " ")}
                </p>
              </div>
              <ShieldCheck className="h-7 w-7 text-blue-400 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Market Macro Regime</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{run.marketRegime}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-purple-400 opacity-80" />
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium">Open IPOs Today</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{run.totalOpenIpos} Issues Active</p>
              </div>
              <Building className="h-7 w-7 text-amber-400 opacity-80" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* FEATURED HERO CARD: BEST IPO TO APPLY TODAY */}
      {bestPick ? (
        <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-background to-background shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <CardHeader className="pb-3 border-b border-border/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  TOP RECOMMENDATION TO APPLY TODAY
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                  {bestPick.exchange} • {bestPick.issueType}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Score:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {bestPick.score.totalScore}/100
                </span>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getVerdictBadge(bestPick.verdict)}`}
                >
                  {bestPick.verdict.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <div>
                <CardTitle className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-2">
                  {bestPick.companyName}
                  <span className="text-base font-mono text-muted-foreground">({bestPick.symbol})</span>
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground mt-1">
                  Bidding Window: {bestPick.openDate} to {bestPick.closeDate}
                </CardDescription>
              </div>

              <div className="flex items-baseline gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-2 rounded-xl">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase">Estimated Listing Gain (GMP)</div>
                  <div className="text-2xl font-black text-emerald-400">
                    +{bestPick.gmpPercent.toFixed(1)}%
                    <span className="text-xs font-normal text-emerald-300 ml-1.5">
                      (₹{bestPick.gmpAmount} / share)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-6">
            {/* Key Issue & Bidding Essentials Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card/60 p-4 rounded-xl border border-border/40">
              <div>
                <p className="text-xs text-muted-foreground">Cut-Off Bid Price</p>
                <p className="text-base font-bold text-foreground mt-0.5">₹{bestPick.priceCap}</p>
                <p className="text-[11px] text-muted-foreground">Bid at cap price</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Minimum Lot Size</p>
                <p className="text-base font-bold text-foreground mt-0.5">{bestPick.lotSize} Shares</p>
                <p className="text-[11px] text-muted-foreground">1 Retail Application Lot</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">1 Lot Capital Required</p>
                <p className="text-base font-bold text-emerald-400 mt-0.5">
                  {formatInr(bestPick.minInvestment)}
                </p>
                <p className="text-[11px] text-muted-foreground">Blocked via UPI/ASBA</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Optimal Strategy</p>
                <p className="text-base font-bold text-blue-400 mt-0.5">
                  {bestPick.strategy.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-muted-foreground">1 Lot per PAN</p>
              </div>
            </div>

            {/* Live Subscription Demand Gauges */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  Institutional & Category Subscription Multiples
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  Total Demand: {bestPick.totalSub}x
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-card/50 p-3 rounded-lg border border-border/40">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">QIB (Institutions)</span>
                    <span className="font-bold text-emerald-400">{bestPick.qibSub}x</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (bestPick.qibSub / 20) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-card/50 p-3 rounded-lg border border-border/40">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">NII / HNI</span>
                    <span className="font-bold text-blue-400">{bestPick.niiSub}x</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (bestPick.niiSub / 15) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-card/50 p-3 rounded-lg border border-border/40">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Retail (Individual)</span>
                    <span className="font-bold text-purple-400">{bestPick.retailSub}x</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (bestPick.retailSub / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* AI Advisor Thesis & Prospectus Risks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-950/15 border border-emerald-500/20 p-4 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Key Strengths & Catalysts
                </h4>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  {bestPick.reasonsFor.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                  {bestPick.aiThesis && (
                    <li className="mt-2 text-foreground/90 italic pt-1 border-t border-emerald-500/20">
                      &quot;{bestPick.aiThesis}&quot;
                    </li>
                  )}
                </ul>
              </div>

              <div className="bg-rose-950/15 border border-rose-500/20 p-4 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Prospectus Risks & Caveats
                </h4>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  {bestPick.reasonsAgainst.length > 0 ? (
                    bestPick.reasonsAgainst.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">No critical red flags identified in draft prospectus.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-emerald-400" />
                <span>
                  Allotment rule: Apply at Cut-Off Price (₹{bestPick.priceCap}) using UPI Mandate in your broker app.
                </span>
              </div>

              <Button
                onClick={() => setAppliedModalIpo(bestPick)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2 shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                Log Application in Tracker
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* AVOID ALL HERO STATE */
        <Card className="border border-amber-500/30 bg-amber-950/10 p-6 rounded-2xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/15 rounded-xl border border-amber-500/30">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-300">AVOID ALL OPEN IPOS TODAY</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Zero open IPOs satisfy North&apos;s conservative risk-reward threshold (minimum 60/100 score). Capital preservation is prioritized over speculative bidding.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Daily AI Briefing Markdown Card */}
      {run?.aiSynthesis && (
        <Card className="bg-card/40 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              North AI Prospectus & Primary Market Commentary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground prose prose-invert max-w-none">
            <ReactMarkdown>{run.aiSynthesis}</ReactMarkdown>
          </CardContent>
        </Card>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTab("open")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "open"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          Open for Bidding ({openIpos.length})
        </button>

        <button
          onClick={() => setActiveTab("upcoming")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "upcoming"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          Upcoming Pipeline ({upcomingIpos.length})
        </button>


        <button
          onClick={() => setActiveTab("applications")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === "applications"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          My Applications ({userApplications.length})
        </button>
      </div>

      {/* TAB CONTENT 1: OPEN IPOS */}
      {activeTab === "open" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openIpos.map((ipo) => (
            <Card
              key={ipo.symbol}
              className={`bg-card/40 border transition-all hover:border-border/80 ${
                ipo.isBestPick ? "border-emerald-500/40 shadow-emerald-950/20 shadow-md" : "border-border/40"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {ipo.companyName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {ipo.symbol} • {ipo.issueType}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getVerdictBadge(
                      ipo.verdict,
                    )}`}
                  >
                    {ipo.verdict.replace(/_/g, " ")}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">Estimated GMP</span>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">
                      +{ipo.expectedListingGain.toFixed(1)}% (₹{ipo.gmpAmount})
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Total Demand</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{ipo.totalSub}x</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <div>
                    Price Cap: <span className="font-semibold text-foreground">₹{ipo.priceCap}</span>
                  </div>
                  <div>
                    Min Lot: <span className="font-semibold text-foreground">{ipo.lotSize} Shares</span>
                  </div>
                  <div>
                    1 Lot Capital:{" "}
                    <span className="font-semibold text-foreground">{formatInr(ipo.minInvestment)}</span>
                  </div>
                  <div>
                    Closes: <span className="font-semibold text-foreground">{ipo.closeDate}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border/30">
                  <span className="text-[11px] text-muted-foreground">Score: {ipo.score.totalScore}/100</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAppliedModalIpo(ipo)}
                    className="text-xs h-7 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-400"
                  >
                    Log Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB CONTENT 2: UPCOMING PIPELINE */}
      {activeTab === "upcoming" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {upcomingIpos.map((ipo: IpoDetails) => (
            <Card key={ipo.symbol} className="bg-card/40 border-border/40">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {ipo.companyName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {ipo.symbol} • {ipo.issueType}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Upcoming
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  <span>
                    Opens on <strong className="text-foreground">{typeof ipo.openDate === "string" ? ipo.openDate : ipo.openDate.toISOString().slice(0, 10)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
                  <div>
                    Price Band: <span className="font-semibold text-foreground">₹{ipo.priceFloor} - ₹{ipo.priceCap}</span>
                  </div>
                  <div>
                    Issue Size: <span className="font-semibold text-foreground">₹{ipo.issueSizeCr} Cr</span>
                  </div>
                  <div>
                    Min Lot: <span className="font-semibold text-foreground">{ipo.lotSize} Shares</span>
                  </div>
                  <div>
                    Fresh Issue: <span className="font-semibold text-foreground">₹{ipo.freshIssueCr} Cr</span>
                  </div>
                </div>

                <p className="text-muted-foreground text-xs line-clamp-2">
                  {ipo.summaryThesis}
                </p>

                {ipo.rhpUrl && (
                  <a
                    href={ipo.rhpUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline pt-1"
                  >
                    <span>View Red Herring Prospectus (RHP)</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}


      {/* TAB CONTENT 4: MY APPLICATIONS */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          {userApplications.length === 0 ? (
            <Card className="bg-card/30 border-border/40 p-8 text-center">
              <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-foreground font-semibold">No applications recorded yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                When you apply for an open IPO, click &quot;Log Application&quot; to track your mandate, allotment, and listing returns.
              </p>
            </Card>
          ) : (
            <div className="border border-border/40 rounded-xl overflow-hidden bg-card/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/40">
                    <tr>
                      <th className="p-3 font-semibold">Company</th>
                      <th className="p-3 font-semibold">Lots Applied</th>
                      <th className="p-3 font-semibold">Bid Price</th>
                      <th className="p-3 font-semibold">Capital Blocked</th>
                      <th className="p-3 font-semibold">UPI ID</th>
                      <th className="p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {userApplications.map((app: any) => (
                      <tr key={app.id} className="hover:bg-muted/20 transition">
                        <td className="p-3 font-bold text-foreground">
                          {app.ipo?.companyName || app.symbol}
                        </td>
                        <td className="p-3 font-mono">{app.lotsApplied} Lot</td>
                        <td className="p-3 font-mono">₹{app.bidPrice}</td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {formatInr(app.totalAmountBlocked)}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {app.upiIdUsed || "Default UPI"}
                        </td>
                        <td className="p-3">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPLICATION LOG MODAL */}
      {appliedModalIpo && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">Log IPO Application</h3>
              <button
                onClick={() => setAppliedModalIpo(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground">Company:</span>
                <p className="font-bold text-foreground text-sm">{appliedModalIpo.companyName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Cut-off Price:</span>
                  <p className="font-bold text-foreground">₹{appliedModalIpo.priceCap}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Shares Per Lot:</span>
                  <p className="font-bold text-foreground">{appliedModalIpo.lotSize}</p>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Lots to Apply (1 Lot Recommended for Retail):</label>
                <input
                  type="number"
                  min={1}
                  max={13}
                  value={lotCount}
                  onChange={(e) => setLotCount(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-muted/40 border border-border/60 rounded-lg p-2 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">UPI ID for ASBA Mandate (Optional):</label>
                <input
                  type="text"
                  placeholder="user@okhdfcbank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full bg-muted/40 border border-border/60 rounded-lg p-2 font-mono text-sm"
                />
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/25 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Blocked Amount:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {formatInr(appliedModalIpo.priceCap * appliedModalIpo.lotSize * lotCount)}
                  </span>
                </div>
              </div>

              {applySuccessMsg && (
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded text-center font-semibold">
                  {applySuccessMsg}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAppliedModalIpo(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  applyMutation.mutate({
                    symbol: appliedModalIpo.symbol,
                    lotsApplied: lotCount,
                    upiIdUsed: upiId,
                  })
                }
                disabled={applyMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {applyMutation.isPending ? "Recording..." : "Confirm Application"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
