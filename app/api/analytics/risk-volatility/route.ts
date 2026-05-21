import { NextRequest, NextResponse } from "next/server";
import { analyzeRiskAndVolatility, calculateCategorySensitivityImpact, analyzeCategorySpendingPatterns, calculateCategoryRiskProfiles } from "@/src/services/RiskVolatilityService";
import { listGoals } from "@/src/services/goals";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const category = searchParams.get("category");
        const months = parseInt(searchParams.get("months") || "12", 10);

        // Get goals for sensitivity analysis
        const goalsData = await listGoals();
        const goals = Array.isArray(goalsData) ? goalsData : goalsData?.[0] || [];

        if (category) {
            // Specific category sensitivity analysis
            const patterns = await analyzeCategorySpendingPatterns(months);
            const profiles = await calculateCategoryRiskProfiles(patterns);

            if (!patterns.has(category)) {
                return NextResponse.json(
                    { error: `Category '${category}' not found` },
                    { status: 404 }
                );
            }

            const sensitivity = await calculateCategorySensitivityImpact(category, patterns, goals);
            return NextResponse.json(sensitivity);
        } else {
            // Full risk portfolio analysis
            const analysis = await analyzeRiskAndVolatility(goals);
            return NextResponse.json(analysis);
        }
    } catch (error: any) {
        console.error("Risk analysis error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to analyze risk and volatility" },
            { status: 500 }
        );
    }
}
