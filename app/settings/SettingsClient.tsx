"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
        </div>
    );
}
