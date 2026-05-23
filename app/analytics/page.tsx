"use client";

import React from "react";
import { VolatilityAnalysis } from "@/app/components/VolatilityAnalysis";

export default function AnalyticsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">Financial Analytics</h1>
                    <p className="max-w-2xl text-sm text-gray-400 sm:text-base">Comprehensive spending analysis, risk assessment, and volatility detection</p>
                </div>

                <div className="space-y-8">
                    {/* Risk & Volatility Analysis */}
                    <div>
                        <VolatilityAnalysis />
                    </div>

                    {/* Additional Analytics Sections Can Go Here */}
                    <div className="text-sm text-gray-400 p-4 bg-slate-900 rounded-lg border border-slate-700">
                        <p>
                            💡 <strong>Tip:</strong> High volatility in a category means your spending is unpredictable. Consider setting strict
                            budgets for volatile categories to improve goal achievement confidence. Use the sensitivity analysis to understand
                            how controlling spending in specific categories could accelerate your financial goals.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
