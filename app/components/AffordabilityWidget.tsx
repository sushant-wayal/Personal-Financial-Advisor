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
                        <Card size="sm" className="bg-muted/40">
                            <CardContent className="px-4 py-4 text-sm">
                                <div>Affordability score: {result.affordabilityScore ?? "-"}</div>
                                <div>
                                    Impact on runway (months):{" "}
                                    {result.impactOnRunway?.toFixed ? result.impactOnRunway.toFixed(2) : result.impactOnRunway}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
