"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AffordabilityWidget({ price = 0 }: { price?: number }) {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [value, setValue] = useState(price.toString());

    async function evaluate() {
        setLoading(true);
        const res = await fetch(`/api/affordability/evaluate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price: Number(value) }),
        });
        const data = await res.json();
        setResult(data);
        setLoading(false);
    }

    useEffect(() => {
        if (price) {
            setValue(String(price));
        }
    }, [price]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Affordability checker</CardTitle>
                <CardDescription>Stress-test a large purchase</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="affordability-price">Price</Label>
                        <Input id="affordability-price" value={value} onChange={(e) => setValue(e.target.value)} />
                    </div>
                    <Button className={"rounded-lg"} onClick={evaluate} disabled={loading} variant="secondary">
                        {loading ? "Checking..." : "Run analysis"}
                    </Button>
                    {result && (
                        <div className="space-y-3">
                            <Card size="sm" className="bg-muted/40">
                                <CardContent className="px-4 py-4 text-sm space-y-2">
                                    <div className="font-medium">Financial Impact:</div>
                                    <div className="text-xs">
                                        <span className="font-semibold">Affordability score:</span> {Math.round(result.affordabilityScore ?? 0)} / 100
                                    </div>
                                    <div className="text-xs">
                                        <span className="font-semibold">Impact on runway:</span>{" "}
                                        {result.impactOnRunway?.toFixed ? result.impactOnRunway.toFixed(2) : result.impactOnRunway} months
                                        {result.impactOnRunway < 0 && <span className="ml-1 text-rose-400">(reduced)</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        Emergency fund: ₹{Math.round(result.health?.emergencyFund ?? 0)} • Monthly expenses: ₹{Math.round(result.health?.monthlyExpenses ?? 0)}
                                    </div>
                                </CardContent>
                            </Card>

                            {result.goalImpacts && result.goalImpacts.length > 0 && (
                                <Card size="sm" className="bg-amber-950/20 border-amber-700/30">
                                    <CardContent className="px-4 py-4 text-sm space-y-2">
                                        <div className="font-medium text-amber-400">Goal Impact Analysis:</div>
                                        <div className="space-y-2">
                                            {result.goalImpacts.map((g: any) => (
                                                <div key={g.id} className="text-xs bg-black/30 rounded p-2">
                                                    <div className="font-medium text-white">{g.title}</div>
                                                    {g.delayMonths === null ? (
                                                        <div className="text-muted-foreground">No monthly target set</div>
                                                    ) : (
                                                        <>
                                                            <div className="text-amber-300">
                                                                Delayed by <span className="font-semibold">{g.delayMonths.toFixed(1)} months</span>
                                                            </div>
                                                            <div className="text-muted-foreground">
                                                                New ETA: {g.newEta ? new Date(g.newEta).toLocaleDateString() : "-"}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
