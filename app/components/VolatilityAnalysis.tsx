"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RiskPortfolio {
    overallVolatilityScore: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    highRiskCategories: string[];
    predictedMonthlySpend: number;
    predictedSpendRange: { min: number; max: number };
    spendStability: {
        stableCategories: string[];
        volatileCategories: string[];
        predictable: boolean;
    };
    recommendations: string[];
}

interface CategoryPattern {
    category: string;
    avgMonthly: number;
    stdDeviation: number;
    coefficient: number;
    minSpend: number;
    maxSpend: number;
}

interface VolatilityAnalysisProps {
    isLoading?: boolean;
}

export function VolatilityAnalysis({ isLoading = false }: VolatilityAnalysisProps) {
    const [data, setData] = useState<any>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sensitivity, setSensitivity] = useState<any>(null);
    const [loading, setLoading] = useState(isLoading);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRiskAnalysis();
    }, []);

    const fetchRiskAnalysis = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/analytics/risk-volatility");
            if (!response.ok) throw new Error("Failed to fetch risk analysis");
            const result = await response.json();
            setData(result);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Error loading risk analysis");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategorySensitivity = async (category: string) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analytics/risk-volatility?category=${encodeURIComponent(category)}`);
            if (!response.ok) throw new Error("Failed to fetch sensitivity analysis");
            const result = await response.json();
            setSensitivity(result);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-700 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-gray-700 rounded w-1/3" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-700 rounded" />
                        <div className="h-4 bg-gray-700 rounded" />
                        <div className="h-4 bg-gray-700 rounded w-5/6" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-950 border border-red-700 rounded-lg text-red-400">
                <p className="font-semibold">Error loading analysis</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    if (!data) return null;

    const summary: RiskPortfolio = data.summary;
    const patterns: Record<string, CategoryPattern> = data.patterns || {};

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);

    const getRiskColor = (level: string) => {
        switch (level) {
            case "low":
                return "text-green-400";
            case "medium":
                return "text-yellow-400";
            case "high":
                return "text-orange-400";
            case "critical":
                return "text-red-400";
            default:
                return "text-gray-400";
        }
    };

    const getRiskBg = (level: string) => {
        switch (level) {
            case "low":
                return "bg-green-950";
            case "medium":
                return "bg-yellow-950";
            case "high":
                return "bg-orange-950";
            case "critical":
                return "bg-red-950";
            default:
                return "bg-gray-950";
        }
    };

    return (
        <div className="space-y-6">
            {/* Overall Risk Summary */}
            <Card className="border-slate-700">
                <CardHeader>
                    <CardTitle>Financial Risk & Volatility Assessment</CardTitle>
                    <CardDescription>Spending pattern analysis and risk portfolio management</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Risk Gauge */}
                    <div className={`p-6 rounded-lg ${getRiskBg(summary.riskLevel)}`}>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm text-gray-400 mb-1">Overall Volatility Score</p>
                                <p className={`text-4xl font-bold ${getRiskColor(summary.riskLevel)}`}>
                                    {summary.overallVolatilityScore.toFixed(1)}/100
                                </p>
                                <p className={`text-lg font-semibold mt-2 ${getRiskColor(summary.riskLevel)}`}>
                                    {summary.riskLevel.toUpperCase()}
                                </p>
                            </div>
                            <div className="text-right space-y-2">
                                <div>
                                    <p className="text-xs text-gray-400">Predictability</p>
                                    <p className={`font-semibold ${summary.spendStability.predictable ? "text-green-400" : "text-orange-400"}`}>
                                        {summary.spendStability.predictable ? "✓ Predictable" : "⚠ Volatile"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Volatility Bar */}
                        <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-full ${summary.overallVolatilityScore < 20
                                        ? "bg-green-500"
                                        : summary.overallVolatilityScore < 40
                                            ? "bg-yellow-500"
                                            : summary.overallVolatilityScore < 70
                                                ? "bg-orange-500"
                                                : "bg-red-500"
                                    }`}
                                style={{ width: `${summary.overallVolatilityScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Predicted Spending Range */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <p className="text-sm text-gray-400 mb-1">Predicted Minimum</p>
                            <p className="text-2xl font-bold text-green-400">{formatCurrency(summary.predictedSpendRange.min)}</p>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <p className="text-sm text-gray-400 mb-1">Expected Monthly</p>
                            <p className="text-2xl font-bold text-blue-400">{formatCurrency(summary.predictedMonthlySpend)}</p>
                        </div>
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <p className="text-sm text-gray-400 mb-1">Predicted Maximum</p>
                            <p className="text-2xl font-bold text-red-400">{formatCurrency(summary.predictedSpendRange.max)}</p>
                        </div>
                    </div>

                    {/* Risk Categories */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* High Risk */}
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <p className="text-sm font-semibold text-orange-400 mb-2">⚠ High Risk Categories ({summary.highRiskCategories.length})</p>
                            {summary.highRiskCategories.length > 0 ? (
                                <div className="space-y-2">
                                    {summary.highRiskCategories.slice(0, 5).map((cat) => (
                                        <button
                                            key={cat}
                                            onClick={() => {
                                                setSelectedCategory(cat);
                                                fetchCategorySensitivity(cat);
                                            }}
                                            className="w-full text-left p-2 text-sm bg-red-950 hover:bg-red-900 rounded text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            {cat} →
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-green-400">No high-risk categories detected</p>
                            )}
                        </div>

                        {/* Stable Categories */}
                        <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
                            <p className="text-sm font-semibold text-green-400 mb-2">✓ Stable Categories ({summary.spendStability.stableCategories.length})</p>
                            {summary.spendStability.stableCategories.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {summary.spendStability.stableCategories.slice(0, 5).map((cat) => (
                                        <span key={cat} className="px-2 py-1 bg-green-950 text-green-400 text-xs rounded">
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">All categories show variability</p>
                            )}
                        </div>
                    </div>

                    {/* Recommendations */}
                    {summary.recommendations.length > 0 && (
                        <div className="p-4 bg-blue-950 border border-blue-700 rounded-lg">
                            <p className="text-sm font-semibold text-blue-400 mb-3">💡 Recommendations</p>
                            <ul className="space-y-2">
                                {summary.recommendations.map((rec, i) => (
                                    <li key={i} className="text-sm text-gray-300 flex items-start">
                                        <span className="text-blue-400 mr-2">•</span>
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card className="border-slate-700">
                <CardHeader>
                    <CardTitle>Category-Level Volatility</CardTitle>
                    <CardDescription>Click on a category to see sensitivity analysis</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Object.entries(patterns)
                            .sort(([, a], [, b]) => b.coefficient - a.coefficient)
                            .slice(0, 10)
                            .map(([category, pattern]) => {
                                const isHigh = summary.highRiskCategories.includes(category);
                                const volatilityPct = Math.min(100, pattern.coefficient * 100);

                                return (
                                    <button
                                        key={category}
                                        onClick={() => {
                                            setSelectedCategory(category);
                                            fetchCategorySensitivity(category);
                                        }}
                                        className="w-full p-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg text-left transition-colors"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-semibold">{category}</span>
                                            <span
                                                className={`text-sm font-bold px-2 py-1 rounded ${isHigh ? "bg-red-950 text-red-400" : "bg-yellow-950 text-yellow-400"
                                                    }`}
                                            >
                                                {volatilityPct.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="space-y-1 text-sm text-gray-400">
                                            <div className="flex justify-between">
                                                <span>Avg Monthly:</span>
                                                <span>{formatCurrency(pattern.avgMonthly)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Range:</span>
                                                <span>
                                                    {formatCurrency(pattern.minSpend)} - {formatCurrency(pattern.maxSpend)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2 mt-2 overflow-hidden">
                                            <div
                                                className={`h-full ${isHigh ? "bg-red-500" : "bg-yellow-500"}`}
                                                style={{ width: `${volatilityPct}%` }}
                                            />
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </CardContent>
            </Card>

            {/* Sensitivity Analysis Panel */}
            {selectedCategory && sensitivity && (
                <Card className="border-slate-700 border-2 border-blue-700">
                    <CardHeader>
                        <CardTitle>Sensitivity Analysis: {selectedCategory}</CardTitle>
                        <CardDescription>How changes in this category affect your financial goals</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-gray-400">
                            Current Monthly Spend: <span className="font-semibold text-white">{formatCurrency(sensitivity.currentSpend)}</span>
                        </p>

                        <div className="space-y-3">
                            {sensitivity.scenarios.map((scenario: any, i: number) => (
                                <div
                                    key={i}
                                    className={`p-4 rounded-lg border ${scenario.percentChange > 0 ? "border-red-700 bg-red-950/30" : scenario.percentChange < 0 ? "border-green-700 bg-green-950/30" : "border-slate-600 bg-slate-900/50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-semibold">{scenario.name} change</span>
                                        <span className="text-sm text-gray-400">{formatCurrency(scenario.newMonthlySpend)}/month</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                            <p className="text-gray-400">Monthly Balance Impact</p>
                                            <p
                                                className={`font-semibold ${scenario.monthlyImpactOnBalance > 0 ? "text-green-400" : "text-red-400"}`}
                                            >
                                                {scenario.monthlyImpactOnBalance > 0 ? "+" : ""}{formatCurrency(scenario.monthlyImpactOnBalance)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Annual Impact</p>
                                            <p
                                                className={`font-semibold ${scenario.annualImpactOnBalance > 0 ? "text-green-400" : "text-red-400"}`}
                                            >
                                                {scenario.annualImpactOnBalance > 0 ? "+" : ""}{formatCurrency(scenario.annualImpactOnBalance)}
                                            </p>
                                        </div>
                                    </div>

                                    {scenario.goalsAffected && scenario.goalsAffected.length > 0 && (
                                        <div className="text-xs text-gray-400 space-y-1">
                                            <p className="font-semibold text-gray-300 mb-1">Goals Affected:</p>
                                            {scenario.goalsAffected.map((goal: any, j: number) => (
                                                <div key={j} className="ml-2">
                                                    {goal.goalName}: {goal.impactOnTimeline > 0 ? "+" : ""}{goal.impactOnTimeline.toFixed(1)} months
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                setSelectedCategory(null);
                                setSensitivity(null);
                            }}
                            className="w-full mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-gray-300 text-sm transition-colors"
                        >
                            Close Analysis
                        </button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
