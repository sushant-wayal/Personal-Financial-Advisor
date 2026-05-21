"use client";

import React from "react";
import { VolatilityAnalysis } from "@/app/components/VolatilityAnalysis";

export default function AnalyticsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">Financial Analytics</h1>
                    <p className="text-gray-400">Comprehensive spending analysis, risk assessment, and volatility detection</p>
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
