import React from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Card from "../../src/components/ui/Card";

export default async function GoalsPage() {
    // Server component: fetch goals via internal API
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/goals`, { cache: "no-store" });
    const data = await res.json();
    const goals = data.goals || [];

    return (
        <div className="min-h-screen">
            <div className="flex">
                <Sidebar />
                <div className="flex-1">
                    <Header />
                    <main id="main" className="px-6 py-8 lg:px-10">
                        <div className="mx-auto max-w-5xl space-y-6">
                            <div>
                                <div className="text-sm font-semibold text-white">Goals</div>
                                <div className="text-xs text-slate-400">Long-term targets and milestones</div>
                            </div>
                            <div className="grid gap-4">
                                {goals.map((g: any) => {
                                    const progress = Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100);
                                    const clamped = Math.min(progress, 100);
                                    return (
                                        <Card key={g.id}>
                                            <div className="flex flex-wrap items-center justify-between gap-4">
                                                <div>
                                                    <div className="font-semibold text-slate-100">{g.title}</div>
                                                    <div className="text-xs text-slate-500">Target: ₹ {g.targetAmount}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-400">Progress</div>
                                                    <div className="text-lg font-semibold text-white">{progress}%</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 h-2 w-full rounded-full bg-white/5">
                                                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${clamped}%` }} />
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
