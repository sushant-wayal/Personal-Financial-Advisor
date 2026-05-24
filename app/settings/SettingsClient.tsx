"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsClient() {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [message, setMessage] = useState("");

    const [profile, setProfile] = useState<any>(null);
    const [savingProfile, setSavingProfile] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const [resSenders, resProfile] = await Promise.all([fetch("/api/gmail/senders"), fetch('/api/profile')]);
                const dataSenders = await resSenders.json();
                const dataProfile = await resProfile.json();
                if (!cancelled) {
                    setInput((dataSenders.senders || []).join(", "));
                    setProfile(dataProfile.profile || {
                        ownerName: "",
                        currency: "INR",
                        balance: 0,
                        emergencyFund: 0,
                        monthlyIncome: 0,
                        monthlyExpenses: 0,
                    });
                }
            } catch (e: any) {
                if (!cancelled) setMessage(String(e));
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

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
            const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data?.error || 'Failed to save profile');
            } else {
                setProfile(data.profile);
                setMessage('Profile saved');
            }
        } catch (e: any) {
            setMessage(String(e));
        } finally {
            setSavingProfile(false);
        }
    }

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
                                    placeholder="alerts@bank.com\nnoreply@bank.com\nhello@bank.com"
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
                                    value={profile?.ownerName || ''}
                                    onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                                    placeholder="Your name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Input
                                        id="currency"
                                        value={profile?.currency || 'INR'}
                                        onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                                        placeholder="INR"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="balance">Balance</Label>
                                    <Input
                                        id="balance"
                                        type="number"
                                        value={profile?.balance ?? 0}
                                        onChange={(e) => setProfile({ ...profile, balance: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="emergency-fund">Emergency fund</Label>
                                    <Input
                                        id="emergency-fund"
                                        type="number"
                                        value={profile?.emergencyFund ?? 0}
                                        onChange={(e) => setProfile({ ...profile, emergencyFund: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="monthly-income">Monthly income</Label>
                                    <Input
                                        id="monthly-income"
                                        type="number"
                                        value={profile?.monthlyIncome ?? 0}
                                        onChange={(e) => setProfile({ ...profile, monthlyIncome: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="monthly-expenses">Monthly expenses</Label>
                                <Input
                                    id="monthly-expenses"
                                    type="number"
                                    value={profile?.monthlyExpenses ?? 0}
                                    onChange={(e) => setProfile({ ...profile, monthlyExpenses: Number(e.target.value) })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button onClick={saveProfile} disabled={savingProfile} className="flex-1 rounded-lg">
                                    {savingProfile ? 'Saving...' : 'Save'}
                                </Button>
                                <Button variant="outline" onClick={async () => { const res = await fetch('/api/profile'); const d = await res.json(); setProfile(d.profile); }} className="flex-1 rounded-lg">
                                    Reload
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
