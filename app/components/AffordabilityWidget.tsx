"use client";
import React, { useEffect, useState } from "react";
import Card from "../../src/components/ui/Card";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";

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
            <div>
                <div className="text-sm font-semibold text-white">Affordability checker</div>
                <div className="text-xs text-slate-400">Stress-test a large purchase</div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
                <Input value={value} onChange={(e) => setValue(e.target.value)} label="Price" />
                <Button onClick={evaluate} disabled={loading} variant="secondary">
                    {loading ? "Checking..." : "Run analysis"}
                </Button>
            </div>
            {result && (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                    <div>Affordability score: {result.affordabilityScore ?? "-"}</div>
                    <div>
                        Impact on runway (months):{" "}
                        {result.impactOnRunway?.toFixed ? result.impactOnRunway.toFixed(2) : result.impactOnRunway}
                    </div>
                </div>
            )}
        </Card>
    );
}
