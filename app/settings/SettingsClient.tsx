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

                            {/* Emergency Fund — time-based section */}
                            <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🛡️</span>
                                    <div>
                                        <div className="text-sm font-semibold text-orange-300">Emergency Fund Configuration</div>
                                        <div className="text-xs text-slate-400">Set how many months your fund should cover. We calculate the required amount from your actual spending.</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ef-months" className="text-orange-200/80">
                                        Coverage (months)
                                        <span className="ml-1 text-xs text-slate-500">min 3</span>
                                    </Label>
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
                                        className="border-orange-500/30 focus-visible:ring-orange-400/30"
                                    />
                                </div>

                                {/* Live computed summary */}
                                {efStatus && (
                                    <div className="rounded-lg bg-black/20 px-4 py-3 space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Avg monthly spending</span>
                                            <span className="text-slate-200 font-medium">{formatCurrency(efStatus.avgMonthlyExpenses, currency)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Target ({months} months)</span>
                                            <span className="text-orange-300 font-semibold">{formatCurrency(efStatus.targetAmount, currency)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Saved (auto · from balance)</span>
                                            <span className="text-slate-200 font-medium">{formatCurrency(efStatus.savedAmount, currency)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Shortfall</span>
                                            <span className={efStatus.shortfall > 0 ? "text-rose-400 font-medium" : "text-emerald-400 font-medium"}>
                                                {efStatus.shortfall > 0 ? `−${formatCurrency(efStatus.shortfall, currency)}` : "✓ Fully funded"}
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="space-y-1 pt-1">
                                            <div className="flex justify-between text-xs text-slate-500">
                                                <span>Progress</span>
                                                <span>{efStatus.progressPct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-white/10">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all duration-500 ${efStatus.isComplete ? "bg-emerald-400" : "bg-orange-400"}`}
                                                    style={{ width: `${Math.min(100, efStatus.progressPct)}%` }}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 pt-1">
                                            Saved amount is auto-derived from your account balance.
                                        </p>
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
