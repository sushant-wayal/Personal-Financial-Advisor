"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileText, Check, Loader2 } from "lucide-react";

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

export default function SettingsClient() {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [message, setMessage] = useState("");

    const [profile, setProfile] = useState<any>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [efStatus, setEfStatus] = useState<any>(null);
    const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done" | "error">("idle");
    const [exportStepText, setExportStepText] = useState("Gathering profile & accounts...");

    async function exportContext() {
        setExportStatus("exporting");
        const steps = [
            "Gathering profile & accounts...",
            "Analyzing 90-day transactions...",
            "Calculating net worth & goals...",
            "Structuring budgets & subscriptions...",
            "Formatting Markdown export..."
        ];
        let stepIdx = 0;
        setExportStepText(steps[0]);

        const interval = setInterval(() => {
            stepIdx = (stepIdx + 1) % steps.length;
            setExportStepText(steps[stepIdx]);
        }, 350);

        try {
            const res = await fetch("/api/export-context");
            const data = await res.json();
            clearInterval(interval);

            if (!res.ok || !data.ok) {
                setExportStatus("error");
                setMessage(data?.error || "Failed to export context.");
                return;
            }

            setExportStepText("Downloading file...");
            const blob = new Blob([data.content], { type: "text/markdown;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename || "financial-context.md";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setExportStatus("done");
            setTimeout(() => setExportStatus("idle"), 3000);
        } catch (e: any) {
            clearInterval(interval);
            setExportStatus("error");
            setMessage(String(e));
            setTimeout(() => setExportStatus("idle"), 4000);
        }
    }


    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const [resSenders, resProfile, resEF] = await Promise.all([
                    fetch("/api/gmail/senders"),
                    fetch("/api/profile"),
                    fetch("/api/emergency-fund"),
                ]);
                const dataSenders = await resSenders.json();
                const dataProfile = await resProfile.json();
                const dataEF = await resEF.json();
                if (!cancelled) {
                    setInput((dataSenders.senders || []).join(", "));
                    setProfile(dataProfile.profile || {
                        ownerName: "",
                        currency: "INR",
                        balance: 0,
                        emergencyFundMonths: 6,
                        monthlyIncome: 0,
                        monthlyExpenses: 0,
                    });
                    if (dataEF.ok) setEfStatus(dataEF);
                }
            } catch (e: any) {
                if (!cancelled) setMessage(String(e));
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    // Refresh EF status whenever profile changes
    useEffect(() => {
        if (!profile) return;
        fetch("/api/emergency-fund").then(r => r.json()).then(d => { if (d.ok) setEfStatus(d); }).catch(() => {});
    }, [profile?.emergencyFundMonths]);

    async function saveSenders() {
        setStatus("saving");
        setMessage("");
        try {
            const res = await fetch("/api/gmail/senders", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senders: input }),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus("error");
                setMessage(data?.error || "Failed to save senders.");
                return;
            }
            setStatus("saved");
            setMessage("Saved sender list.");
        } catch (e: any) {
            setStatus("error");
            setMessage(String(e));
        }
    }

    async function saveProfile() {
        setSavingProfile(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profile),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data?.error || "Failed to save profile");
            } else {
                setProfile(data.profile);
                setMessage("Profile saved");
                // Refresh EF status
                fetch("/api/emergency-fund").then(r => r.json()).then(d => { if (d.ok) setEfStatus(d); }).catch(() => {});
            }
        } catch (e: any) {
            setMessage(String(e));
        } finally {
            setSavingProfile(false);
        }
    }

    const months = profile?.emergencyFundMonths ?? 6;
    const currency = profile?.currency || "INR";

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Gmail Senders Card */}
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle>Gmail Senders</CardTitle>
                        <CardDescription>Bank alerts and transaction notifications</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1">
                        <div className="space-y-4 flex flex-col flex-1">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="gmail-senders">Allowed senders</Label>
                                <Textarea
                                    id="gmail-senders"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    rows={10}
                                    placeholder={"alerts@bank.com\nnoreply@bank.com\nhello@bank.com"}
                                    className="resize-none h-full"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter one email per line, or separate multiple emails with commas.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button onClick={saveSenders} disabled={status === "saving"} className="w-full rounded-lg">
                                    {status === "saving" ? "Saving..." : "Save senders"}
                                </Button>
                            </div>
                            {message && (
                                <span className={`text-xs ${status === "error" ? "text-destructive" : "text-emerald-500"}`}>
                                    {message}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Financial Profile Card */}
                <Card className="h-full">
                    <CardHeader>
                        <CardTitle>Financial Profile</CardTitle>
                        <CardDescription>Basic values used by analyses</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="owner-name">Owner name</Label>
                                <Input
                                    id="owner-name"
                                    value={profile?.ownerName || ""}
                                    onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Input
                                        id="currency"
                                        value={profile?.currency || "INR"}
                                        onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                                        placeholder="INR"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="balance">Balance</Label>
                                    <Input
                                        id="balance"
                                        type="number"
                                        value={Math.round((profile?.balance ?? 0) * 100) / 100}
                                        onChange={(e) => setProfile({ ...profile, balance: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="monthly-income">Monthly income</Label>
                                    <Input
                                        id="monthly-income"
                                        type="number"
                                        value={profile?.monthlyIncome ?? 0}
                                        placeholder="0"
                                        disabled
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="monthly-expenses">Monthly expenses</Label>
                                    <Input
                                        id="monthly-expenses"
                                        type="number"
                                        value={profile?.monthlyExpenses ?? 0}
                                        placeholder="0"
                                        disabled
                                    />
                                </div>
                            </div>

                            {/* Emergency Fund & Allocation Section */}
                            <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-6 space-y-6">
                                <div className="space-y-1">
                                    <div className="text-xs font-mono tracking-widest text-orange-400 uppercase font-bold">
                                        Emergency Reserve & Strategy
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Configure emergency safety coverage and monthly capital allocation splits.
                                    </p>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-white/5">
                                    <div>
                                        <Label htmlFor="ef-months" className="text-xs font-medium text-slate-200">
                                            Coverage Target
                                        </Label>
                                        <div className="text-[11px] text-slate-500">Min 3 months of expenses</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="ef-months"
                                            type="number"
                                            min={3}
                                            value={profile?.emergencyFundMonths ?? 6}
                                            onChange={(e) => {
                                                const v = Math.max(3, Number(e.target.value));
                                                setProfile({ ...profile, emergencyFundMonths: v });
                                            }}
                                            placeholder="6"
                                            className="w-24 h-9 text-right font-mono text-xs border-white/10 bg-black/40 text-slate-100 focus-visible:ring-orange-500/30"
                                        />
                                        <span className="text-xs text-slate-400 font-mono">months</span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-medium text-slate-200">
                                            Allocation Strategy
                                        </Label>
                                        <span className="text-[11px] font-mono text-orange-400 font-semibold">
                                            {profile?.efStrategy === "AGGRESSIVE_EF" && "85% EF • 15% Goals"}
                                            {profile?.efStrategy === "ACCELERATED_GOALS" && "50% EF • 50% Goals"}
                                            {profile?.efStrategy === "STRICT" && "100% EF • 0% Goals"}
                                            {(!profile?.efStrategy || profile?.efStrategy === "BALANCED") && "70% EF • 30% Goals"}
                                        </span>
                                    </div>

                                    {/* Segmented Control Tabs */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
                                        {[
                                            { id: "BALANCED", label: "⚖️ Balanced" },
                                            { id: "AGGRESSIVE_EF", label: "🛡️ Aggressive" },
                                            { id: "ACCELERATED_GOALS", label: "🚀 Accelerated" },
                                            { id: "STRICT", label: "🔒 Strict" },
                                        ].map((tab) => {
                                            const active = (profile?.efStrategy || "BALANCED") === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setProfile({ ...profile, efStrategy: tab.id })}
                                                    className={`py-2 px-2.5 rounded-lg text-xs font-medium text-center transition-all ${
                                                        active
                                                            ? "bg-orange-500 text-white font-semibold shadow"
                                                            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                                                    }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Live Metrics List */}
                                {efStatus && (
                                    <div className="space-y-3 pt-3 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Monthly Expenses</span>
                                            <span className="font-mono text-slate-200">{formatCurrency(efStatus.avgMonthlyExpenses, currency)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Target Reserve ({months} mo)</span>
                                            <span className="font-mono text-orange-400 font-semibold">{formatCurrency(efStatus.targetAmount, currency)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">EF Reserved Cash</span>
                                            <span className="font-mono text-slate-100">{formatCurrency(efStatus.savedAmount, currency)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Goals Available Pool</span>
                                            <span className="font-mono text-emerald-400 font-medium">{formatCurrency(efStatus.availableBalance, currency)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-400">Monthly Drip (EF / Goals)</span>
                                            <span className="font-mono text-slate-200">
                                                {formatCurrency(efStatus.efMonthlyDrip, currency)} / {formatCurrency(efStatus.availableGoalCapacity, currency)}
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="space-y-1.5 pt-2">
                                            <div className="flex items-center justify-between text-[11px] font-mono">
                                                <span className="text-slate-400">EF Funding Level (Tier {efStatus.tier ?? 2})</span>
                                                <span className="text-orange-400 font-bold">{efStatus.progressPct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${efStatus.isComplete ? "bg-emerald-400" : "bg-orange-500"}`}
                                                    style={{ width: `${Math.min(100, efStatus.progressPct)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Monthly Investment Configuration Section */}
                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-6 space-y-6">
                                <div className="space-y-1">
                                    <div className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-bold">
                                        Investment Strategy Configuration
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Customize salary pay cycle length and phase/asset-allocation percentages.
                                    </p>
                                </div>

                                {/* Salary Cycle Days */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/5">
                                    <div>
                                        <Label htmlFor="salary-cycle" className="text-xs font-medium text-slate-200">
                                            Pay Cycle Length
                                        </Label>
                                        <div className="text-[11px] text-slate-500">Clamped between 30 and 33 days</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="salary-cycle"
                                            type="number"
                                            min={30}
                                            max={33}
                                            value={profile?.salaryCycleDays ?? 33}
                                            onChange={(e) => {
                                                const v = Math.max(30, Math.min(33, Number(e.target.value)));
                                                setProfile({ ...profile, salaryCycleDays: v });
                                            }}
                                            className="w-20 h-9 text-right font-mono text-xs border-white/10 bg-black/40 text-slate-100"
                                        />
                                        <span className="text-xs text-slate-400 font-mono">days</span>
                                    </div>
                                </div>

                                 {/* Phase Rates */}
                                <div className="space-y-3 pt-3 border-t border-white/5">
                                    <div className="text-xs font-medium text-slate-200">Phase Investable Rates (%)</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-[11px] text-slate-400">EF Building Phase %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.efBuildingInvestableRate ?? 15}
                                                onChange={(e) => setProfile({ ...profile, efBuildingInvestableRate: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Goal Sprint Phase %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.goalSprintInvestableRate ?? 40}
                                                onChange={(e) => setProfile({ ...profile, goalSprintInvestableRate: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Wealth Building Phase %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.wealthBuildingInvestableRate ?? 60}
                                                onChange={(e) => setProfile({ ...profile, wealthBuildingInvestableRate: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Crisis Phase %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.crisisInvestableRate ?? 0}
                                                onChange={(e) => setProfile({ ...profile, crisisInvestableRate: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                 {/* Standard Sub-Allocations */}
                                <div className="space-y-3 pt-3 border-t border-white/5">
                                    <div className="text-xs font-medium text-slate-200">Standard Allocation (%)</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-[11px] text-indigo-400">Equity %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.stdEquityPct ?? 70}
                                                onChange={(e) => setProfile({ ...profile, stdEquityPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-emerald-400">Debt %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.stdDebtPct ?? 20}
                                                onChange={(e) => setProfile({ ...profile, stdDebtPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-amber-400">Gold %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.stdGoldPct ?? 10}
                                                onChange={(e) => setProfile({ ...profile, stdGoldPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Conservative Sub-Allocations */}
                                <div className="space-y-3 pt-3 border-t border-white/5">
                                    <div className="text-xs font-medium text-slate-200">Emergency Reserve Allocation (%)</div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <Label className="text-[11px] text-indigo-400">Equity %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.consEquityPct ?? 30}
                                                onChange={(e) => setProfile({ ...profile, consEquityPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-emerald-400">Debt %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.consDebtPct ?? 60}
                                                onChange={(e) => setProfile({ ...profile, consDebtPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-amber-400">Gold %</Label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={profile?.consGoldPct ?? 10}
                                                onChange={(e) => setProfile({ ...profile, consGoldPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Equity Category Distribution Configurable Inputs */}
                                <div className="space-y-2 pt-3 border-t border-white/5">
                                    <div className="text-xs font-medium text-slate-200">Equity Breakdown Ratio (%)</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Nifty 50 %</Label>
                                            <Input
                                                type="number"
                                                value={profile?.equityNifty50Pct ?? 60}
                                                onChange={(e) => setProfile({ ...profile, equityNifty50Pct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Nifty Next 50 %</Label>
                                            <Input
                                                type="number"
                                                value={profile?.equityNiftyNext50Pct ?? 20}
                                                onChange={(e) => setProfile({ ...profile, equityNiftyNext50Pct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-slate-400">Midcap %</Label>
                                            <Input
                                                type="number"
                                                value={profile?.equityMidcapPct ?? 20}
                                                onChange={(e) => setProfile({ ...profile, equityMidcapPct: Number(e.target.value) })}
                                                className="h-8 text-xs font-mono bg-black/40 border-white/10 mt-1"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button onClick={saveProfile} disabled={savingProfile} className="flex-1 rounded-lg">
                                    {savingProfile ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        const res = await fetch("/api/profile");
                                        const d = await res.json();
                                        setProfile(d.profile);
                                    }}
                                    className="flex-1 rounded-lg"
                                >
                                    Reload
                                </Button>
                            </div>
                            {message && (
                                <span className={`text-xs ${message.toLowerCase().includes("error") || message.toLowerCase().includes("fail") ? "text-destructive" : "text-emerald-500"}`}>
                                    {message}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Export Financial Context Card */}
            <Card className="border-border bg-gradient-to-br from-[#1A1A1A] to-[#111] lg:col-span-2">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/15 to-cyan-400/20 text-violet-300">
                            <FileText size={20} />
                        </div>
                        <div>
                            <CardTitle>Export for External LLMs</CardTitle>
                            <CardDescription>Download full financial context file for ChatGPT, Claude, Gemini, etc.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-5">
                        <div className="rounded-xl border border-white/5 bg-black/30 p-4 space-y-3">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Export all your financial data — profile, transactions, net worth assets & liabilities, goals, budgets,
                                subscriptions, and analytics — as a structured Markdown file ready for external AI models.
                            </p>
                            <div className="border-t border-white/5 pt-3 space-y-2">
                                <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider block">
                                    💡 Sample questions to ask your external LLM:
                                </span>
                                <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400">•</span>
                                        <span>&ldquo;Analyze my 90-day spending patterns and suggest 3 areas to optimize.&rdquo;</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400">•</span>
                                        <span>&ldquo;Can I afford a major purchase right now based on my runway and emergency fund?&rdquo;</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400">•</span>
                                        <span>&ldquo;Evaluate my net worth asset allocation vs liabilities.&rdquo;</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="text-violet-400">•</span>
                                        <span>&ldquo;Create a 6-month budget plan aligned with my financial goals.&rdquo;</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                onClick={exportContext}
                                disabled={exportStatus === "exporting"}
                                className="min-w-[240px] gap-2 rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 transition-all duration-300 font-medium"
                            >
                                {exportStatus === "exporting" && <Loader2 size={16} className="animate-spin" />}
                                {exportStatus === "done" && <Check size={16} />}
                                {exportStatus === "idle" && <Download size={16} />}
                                {exportStatus === "error" && <Download size={16} />}
                                {exportStatus === "exporting"
                                    ? exportStepText
                                    : exportStatus === "done"
                                        ? "Downloaded Markdown!"
                                        : "Export Financial Context"}
                            </Button>
                            {exportStatus === "error" && (
                                <span className="text-xs text-destructive">Export failed. Try again.</span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/60">
                            The exported file contains your complete financial profile and transactions. Handle it with care.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
