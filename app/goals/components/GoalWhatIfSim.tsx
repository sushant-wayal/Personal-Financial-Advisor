"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/src/services/shared/formatting";
import type { WhatIfImpact } from "@/src/types/goal";

async function fetchWhatIf(scenario: string, params: Record<string, unknown>) {
    const res = await fetch("/api/goals/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, ...params }),
    });
    if (!res.ok) throw new Error("Failed to simulate scenario");
    return res.json();
}

export function GoalWhatIfSim() {
    const [scenario, setScenario] = useState<"none" | "capacity" | "spending" | "expense">("none");
    const [amount, setAmount] = useState<string>("");

    const { data: result, isPending, mutate: runSim } = useMutation({
        mutationFn: async () => {
            if (scenario === "capacity") {
                return fetchWhatIf("capacity-delta", { amount: Number(amount) });
            } else if (scenario === "spending") {
                return fetchWhatIf("spending-reduction", { categoryName: "discretionary", amount: Number(amount) });
            } else if (scenario === "expense") {
                return fetchWhatIf("large-expense", { expenseName: "purchase", amount: Number(amount) });
            }
            throw new Error("Unknown scenario");
        },
    });

    return (
        <Card className="overflow-hidden border-purple-700/30 bg-purple-950/10 px-4 py-4 sm:px-6 sm:py-6">
            <div>
                <div className="text-sm font-semibold text-purple-300">What-If Simulation</div>
                <div className="text-xs text-slate-400">See how spending changes impact your goals</div>
            </div>
            <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    <Button
                        variant={scenario === "capacity" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setScenario("capacity")}
                        className="rounded-lg"
                    >
                        Savings Increase
                    </Button>
                    <Button
                        variant={scenario === "spending" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setScenario("spending")}
                        className="rounded-lg"
                    >
                        Reduce Spending
                    </Button>
                    <Button
                        variant={scenario === "expense" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setScenario("expense")}
                        className="rounded-lg"
                    >
                        Large Purchase
                    </Button>
                </div>
                {scenario !== "none" && (
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Amount (₹)"
                            className="rounded-lg"
                        />
                        <Button
                            onClick={() => runSim()}
                            disabled={!amount || isPending}
                            className="rounded-lg"
                        >
                            {isPending ? "Simulating..." : "Simulate"}
                        </Button>
                    </div>
                )}
                {result && result.scenario && (
                    <div className="space-y-2 rounded-lg bg-black/20 p-3">
                        <div className="text-sm font-medium text-slate-100">{result.scenario.description}</div>
                        <div className="text-xs text-slate-400">New capacity: {formatCurrency(result.scenario.newMonthlyCapacity)}</div>
                        <div className="space-y-2">
                            {result.scenario.impacts && result.scenario.impacts.map((impact: WhatIfImpact) => (
                                <div key={impact.goalId} className="flex items-center justify-between text-xs text-slate-300">
                                    <span>{impact.goalTitle}</span>
                                    <span className={impact.daysDelta > 0 ? "text-green-400" : impact.daysDelta < 0 ? "text-red-400" : "text-slate-400"}>
                                        {impact.summary}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
