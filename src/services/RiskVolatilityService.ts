import { prisma } from "../lib/prisma";

/**
 * Category-Level Spending Analysis
 */
export interface CategorySpendingPattern {
    category: string;
    totalSpent: number;
    avgMonthly: number;
    stdDeviation: number;
    coefficient: number; // Standard deviation / mean (volatility ratio)
    minSpend: number;
    maxSpend: number;
    spendRange: number; // max - min
    transactionCount: number;
    avgTransactionSize: number;
    months: {
        month: string;
        spent: number;
        count: number;
        avgSize: number;
    }[];
}

/**
 * Risk Assessment for a Category
 */
export interface CategoryRiskProfile {
    category: string;
    volatilityScore: number; // 0-100, higher = more volatile
    riskLevel: "low" | "medium" | "high" | "critical";
    riskFactors: string[];
    volatilityTrend: "increasing" | "decreasing" | "stable";
    predictedNextMonthSpend: number;
    predictedRange: { min: number; max: number };
    outlierMonths: {
        month: string;
        spent: number;
        deviation: number; // standard deviations from mean
    }[];
}

/**
 * Sensitivity Analysis - How changes in category affect financial goals
 */
export interface CategorySensitivityImpact {
    category: string;
    currentSpend: number;
    scenarios: {
        name: string;
        percentChange: number;
        newMonthlySpend: number;
        monthlyImpactOnBalance: number; // positive = more balance, negative = less balance
        annualImpactOnBalance: number;
        goalsAffected: {
            goalId: string;
            goalName: string;
            impactOnTimeline: number; // months faster/slower
            newETA: Date | null;
        }[];
        savingsChange: number; // percentage point change in savings rate
    }[];
}

/**
 * Cross-Category Impact Analysis
 */
export interface CrossCategoryImpact {
    category: string;
    correlations: {
        correlatedCategory: string;
        correlationCoefficient: number; // -1 to 1
        relationshipType: "offsetting" | "competing" | "independent" | "synchronized";
        interpretation: string;
    }[];
}

/**
 * Overall Risk Portfolio Summary
 */
export interface RiskPortfolioSummary {
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

/**
 * Get detailed spending patterns for all categories
 */
export async function analyzeCategorySpendingPatterns(
    months: number = 12
): Promise<Map<string, CategorySpendingPattern>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Fetch all transactions
    const transactions = await prisma.transaction.findMany({
        where: {
            timestamp: { gte: startDate },
            OR: [
                { transactionType: { in: ["DEBIT", "DEBITED", "EXPENSE", "PURCHASE", "WITHDRAWAL", "CHARGE", "BILL", "PAYMENT", "SUBSCRIPTION"] } },
                { type: { in: ["DEBIT", "DEBITED", "EXPENSE", "PURCHASE", "WITHDRAWAL", "CHARGE", "BILL", "PAYMENT", "SUBSCRIPTION"] } },
            ],
        },
        include: { category: true },
        orderBy: { timestamp: "asc" },
    });

    // Group by category and month
    const categoryData: Map<string, Map<string, { spent: number; count: number }>> = new Map();

    transactions.forEach((tx) => {
        const categoryName = tx.category?.name || "Miscellaneous";
        const amount = Math.abs(tx.amount || 0);
        const monthKey = new Date(tx.timestamp).toISOString().slice(0, 7);

        if (!categoryData.has(categoryName)) {
            categoryData.set(categoryName, new Map());
        }

        const monthMap = categoryData.get(categoryName)!;
        const existing = monthMap.get(monthKey) || { spent: 0, count: 0 };
        monthMap.set(monthKey, {
            spent: existing.spent + amount,
            count: existing.count + 1,
        });
    });

    // Calculate statistics for each category
    const patterns: Map<string, CategorySpendingPattern> = new Map();

    categoryData.forEach((monthMap, categoryName) => {
        const monthlyValues = Array.from(monthMap.values());
        const spends = monthlyValues.map((m) => m.spent);
        const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
        const variance = spends.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / spends.length;
        const stdDev = Math.sqrt(variance);
        const coefficient = mean > 0 ? stdDev / mean : 0;

        const monthlyBreakdown: CategorySpendingPattern["months"] = [];
        let monthCurrent = new Date(startDate);
        for (let i = 0; i < months; i++) {
            const monthKey = monthCurrent.toISOString().slice(0, 7);
            const monthData = monthMap.get(monthKey) || { spent: 0, count: 0 };
            monthlyBreakdown.push({
                month: monthKey,
                spent: monthData.spent,
                count: monthData.count,
                avgSize: monthData.count > 0 ? monthData.spent / monthData.count : 0,
            });
            monthCurrent = new Date(monthCurrent.getFullYear(), monthCurrent.getMonth() + 1, 1);
        }

        patterns.set(categoryName, {
            category: categoryName,
            totalSpent: spends.reduce((a, b) => a + b, 0),
            avgMonthly: mean,
            stdDeviation: stdDev,
            coefficient,
            minSpend: Math.min(...spends),
            maxSpend: Math.max(...spends),
            spendRange: Math.max(...spends) - Math.min(...spends),
            transactionCount: transactions.filter((t) => (t.category?.name || "Miscellaneous") === categoryName).length,
            avgTransactionSize: mean / monthlyValues.length,
            months: monthlyBreakdown,
        });
    });

    return patterns;
}

/**
 * Calculate risk profile for each category
 */
export async function calculateCategoryRiskProfiles(
    patterns: Map<string, CategorySpendingPattern>
): Promise<Map<string, CategoryRiskProfile>> {
    const profiles: Map<string, CategoryRiskProfile> = new Map();

    patterns.forEach((pattern) => {
        // Volatility Score: 0-100
        // coefficient < 0.2 = low volatility
        // 0.2 - 0.4 = medium
        // 0.4 - 0.7 = high
        // > 0.7 = critical
        const volatilityScore = Math.min(100, pattern.coefficient * 100);

        // Determine risk level
        let riskLevel: "low" | "medium" | "high" | "critical";
        if (volatilityScore < 20) riskLevel = "low";
        else if (volatilityScore < 40) riskLevel = "medium";
        else if (volatilityScore < 70) riskLevel = "high";
        else riskLevel = "critical";

        // Identify risk factors
        const riskFactors: string[] = [];
        if (pattern.coefficient > 0.5) {
            riskFactors.push("High spending variability");
        }
        if (pattern.spendRange > pattern.avgMonthly * 2) {
            riskFactors.push("Large month-to-month swings");
        }
        if (pattern.maxSpend > pattern.avgMonthly * 2.5) {
            riskFactors.push("Occasional spike spending");
        }
        if (pattern.transactionCount > 50) {
            riskFactors.push("High transaction frequency");
        }

        // Volatility trend (comparing first half vs second half)
        const midpoint = Math.floor(pattern.months.length / 2);
        const firstHalf = pattern.months.slice(0, midpoint).map((m) => m.spent);
        const secondHalf = pattern.months.slice(midpoint).map((m) => m.spent);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const trend: "increasing" | "decreasing" | "stable" =
            Math.abs(secondAvg - firstAvg) < firstAvg * 0.1
                ? "stable"
                : secondAvg > firstAvg
                    ? "increasing"
                    : "decreasing";

        // Predict next month using simple linear regression
        const months = pattern.months.map((_, i) => i);
        const spends = pattern.months.map((m) => m.spent);
        const n = months.length;
        const sumX = months.reduce((a, b) => a + b, 0);
        const sumY = spends.reduce((a, b) => a + b, 0);
        const sumXY = months.reduce((sum, x, i) => sum + x * spends[i], 0);
        const sumX2 = months.reduce((sum, x) => sum + x * x, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const predictedNextMonth = Math.max(0, intercept + slope * n);

        // Predict range using standard deviation
        const predictedMin = Math.max(0, predictedNextMonth - pattern.stdDeviation * 1.5);
        const predictedMax = predictedNextMonth + pattern.stdDeviation * 1.5;

        // Find outlier months
        const outlierMonths = pattern.months
            .map((m) => ({
                month: m.month,
                spent: m.spent,
                deviation: pattern.avgMonthly > 0 ? (m.spent - pattern.avgMonthly) / pattern.stdDeviation : 0,
            }))
            .filter((m) => Math.abs(m.deviation) > 2); // More than 2 standard deviations

        profiles.set(pattern.category, {
            category: pattern.category,
            volatilityScore,
            riskLevel,
            riskFactors,
            volatilityTrend: trend,
            predictedNextMonthSpend: predictedNextMonth,
            predictedRange: { min: predictedMin, max: predictedMax },
            outlierMonths,
        });
    });

    return profiles;
}

/**
 * Sensitivity Analysis: How category changes affect financial health
 */
export async function calculateCategorySensitivityImpact(
    category: string,
    patterns: Map<string, CategorySpendingPattern>,
    goals: any[]
): Promise<CategorySensitivityImpact> {
    const pattern = patterns.get(category);
    if (!pattern) {
        throw new Error(`Category ${category} not found in patterns`);
    }

    // Get current financial profile
    const profile = await prisma.financialProfile.findUnique({ where: { id: "default" } });
    const monthlyIncome = profile?.monthlyIncome ?? 50000;
    const currentMonthlySpend = pattern.avgMonthly;

    // Scenario changes: -50%, -25%, 0%, +25%, +50%
    const percentageChanges = [-50, -25, 0, 25, 50];
    const scenarios = percentageChanges.map((change) => {
        const newSpend = Math.max(0, currentMonthlySpend * (1 + change / 100));
        const spendDifference = newSpend - currentMonthlySpend;
        const monthlyBalanceImpact = -spendDifference; // negative spend = positive balance
        const annualImpact = monthlyBalanceImpact * 12;

        // Calculate savings rate change
        const currentSavingsRate = ((monthlyIncome - currentMonthlySpend) / monthlyIncome) * 100;
        const newSavingsRate = ((monthlyIncome - newSpend) / monthlyIncome) * 100;
        const savingsRateChange = newSavingsRate - currentSavingsRate;

        // Estimate impact on goals
        const goalsAffected = goals
            .filter((g) => g.recommendedMonthlyContribution && g.recommendedMonthlyContribution > 0)
            .map((g) => {
                // If we have more balance, we can achieve goals faster
                const availableCapacity = monthlyIncome - newSpend;
                const currentCapacity = monthlyIncome - currentMonthlySpend;
                const speedup = (availableCapacity - currentCapacity) / (g.recommendedMonthlyContribution || 1);
                const monthInProgress = g.monthsLeft || 12;
                const newMonthsLeft = Math.max(1, monthInProgress - speedup);

                let newETA = null;
                if (g.targetDate) {
                    const eta = new Date(g.targetDate);
                    eta.setMonth(eta.getMonth() - Math.round(newMonthsLeft));
                    newETA = eta;
                }

                return {
                    goalId: g.id,
                    goalName: g.title || g.name,
                    impactOnTimeline: speedup,
                    newETA,
                };
            });

        return {
            name: `${change > 0 ? "+" : ""}${change}%`,
            percentChange: change,
            newMonthlySpend: newSpend,
            monthlyImpactOnBalance: monthlyBalanceImpact,
            annualImpactOnBalance: annualImpact,
            goalsAffected,
            savingsChange: savingsRateChange,
        };
    });

    return {
        category,
        currentSpend: currentMonthlySpend,
        scenarios,
    };
}

/**
 * Cross-category correlation analysis
 */
export async function analyzeCrossCategoryImpacts(
    patterns: Map<string, CategorySpendingPattern>
): Promise<Map<string, CrossCategoryImpact>> {
    const impacts: Map<string, CrossCategoryImpact> = new Map();
    const categories = Array.from(patterns.keys());

    categories.forEach((category1) => {
        const correlations: CrossCategoryImpact["correlations"] = [];

        categories.forEach((category2) => {
            if (category1 === category2) return;

            const pattern1 = patterns.get(category1)!;
            const pattern2 = patterns.get(category2)!;

            // Calculate correlation between monthly spending
            const spends1 = pattern1.months.map((m) => m.spent);
            const spends2 = pattern2.months.map((m) => m.spent);

            const mean1 = spends1.reduce((a, b) => a + b, 0) / spends1.length;
            const mean2 = spends2.reduce((a, b) => a + b, 0) / spends2.length;

            const covariance = spends1.reduce((sum, val, i) => sum + (val - mean1) * (spends2[i] - mean2), 0) / spends1.length;
            const std1 = Math.sqrt(spends1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / spends1.length);
            const std2 = Math.sqrt(spends2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / spends2.length);

            const correlation = std1 > 0 && std2 > 0 ? covariance / (std1 * std2) : 0;

            // Classify relationship
            let relationshipType: "offsetting" | "competing" | "independent" | "synchronized";
            let interpretation = "";

            if (Math.abs(correlation) < 0.2) {
                relationshipType = "independent";
                interpretation = "Spending patterns are independent";
            } else if (correlation > 0.6) {
                relationshipType = "synchronized";
                interpretation = "Categories tend to spike together (e.g., entertainment + food)";
            } else if (correlation < -0.6) {
                relationshipType = "offsetting";
                interpretation = "When one increases, other tends to decrease";
            } else {
                relationshipType = "competing";
                interpretation = "Moderate correlation suggests competing for budget";
            }

            correlations.push({
                correlatedCategory: category2,
                correlationCoefficient: correlation,
                relationshipType,
                interpretation,
            });
        });

        impacts.set(category1, {
            category: category1,
            correlations: correlations.sort((a, b) => Math.abs(b.correlationCoefficient) - Math.abs(a.correlationCoefficient)),
        });
    });

    return impacts;
}

/**
 * Comprehensive Risk Portfolio Summary
 */
export async function generateRiskPortfolioSummary(
    profiles: Map<string, CategoryRiskProfile>,
    patterns: Map<string, CategorySpendingPattern>,
    impacts: Map<string, CrossCategoryImpact>
): Promise<RiskPortfolioSummary> {
    // Overall volatility score (average of all categories, weighted by spend)
    const totalSpend = Array.from(patterns.values()).reduce((sum, p) => sum + p.avgMonthly, 0);
    const overallVolatilityScore = Array.from(profiles.values()).reduce(
        (sum, p) => sum + (p.volatilityScore * (patterns.get(p.category)?.avgMonthly || 0)) / totalSpend,
        0
    );

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (overallVolatilityScore < 20) riskLevel = "low";
    else if (overallVolatilityScore < 40) riskLevel = "medium";
    else if (overallVolatilityScore < 70) riskLevel = "high";
    else riskLevel = "critical";

    // High and low risk categories
    const highRiskCategories = Array.from(profiles.values())
        .filter((p) => p.riskLevel === "high" || p.riskLevel === "critical")
        .map((p) => p.category)
        .sort(
            (a, b) =>
                (profiles.get(b)?.volatilityScore || 0) - (profiles.get(a)?.volatilityScore || 0)
        );

    const stableCategories = Array.from(profiles.values())
        .filter((p) => p.riskLevel === "low")
        .map((p) => p.category);

    const volatileCategories = Array.from(profiles.values())
        .filter((p) => p.riskLevel === "high" || p.riskLevel === "critical")
        .map((p) => p.category);

    // Predicted monthly spend
    const predictedMonthlySpend = Array.from(profiles.values()).reduce((sum, p) => sum + p.predictedNextMonthSpend, 0);
    const minSpend = Array.from(profiles.values()).reduce((sum, p) => sum + p.predictedRange.min, 0);
    const maxSpend = Array.from(profiles.values()).reduce((sum, p) => sum + p.predictedRange.max, 0);

    // Determine predictability
    const predictable =
        highRiskCategories.length <= Math.max(1, Math.floor(profiles.size / 3)) &&
        Array.from(profiles.values()).filter((p) => p.volatilityTrend === "stable").length > profiles.size / 2;

    // Generate recommendations
    const recommendations: string[] = [];

    if (highRiskCategories.length > 0) {
        recommendations.push(
            `Focus on controlling volatile categories: ${highRiskCategories.slice(0, 3).join(", ")}. These showed ${profiles.get(highRiskCategories[0])?.volatilityTrend === "increasing" ? "increasing" : "high"
            } variability.`
        );
    }

    const increasingCategories = Array.from(profiles.values())
        .filter((p) => p.volatilityTrend === "increasing")
        .map((p) => p.category);
    if (increasingCategories.length > 0) {
        recommendations.push(
            `Spending trend worsening in: ${increasingCategories.slice(0, 2).join(", ")}. Set stricter budget limits or investigate root causes.`
        );
    }

    if (!predictable) {
        recommendations.push("Your spending patterns are unpredictable. Consider building a larger emergency fund to buffer against volatility.");
    } else {
        recommendations.push("Good news: Your spending patterns are fairly predictable, making financial planning more reliable.");
    }

    const competingCategories = Array.from(impacts.values())
        .flatMap((i) => i.correlations.filter((c) => c.relationshipType === "competing"))
        .slice(0, 2);
    if (competingCategories.length > 0) {
        recommendations.push(
            `Consider budget-sharing strategies between competing categories: ${competingCategories
                .map((c) => `${c.correlatedCategory} & ${impacts.get(c.correlatedCategory)?.category || ""}`)
                .join(", ")}`
        );
    }

    return {
        overallVolatilityScore,
        riskLevel,
        highRiskCategories,
        predictedMonthlySpend,
        predictedSpendRange: { min: minSpend, max: maxSpend },
        spendStability: {
            stableCategories,
            volatileCategories,
            predictable,
        },
        recommendations,
    };
}

/**
 * Main orchestration function
 */
export async function analyzeRiskAndVolatility(goals: any[] = []) {
    const patterns = await analyzeCategorySpendingPatterns(12);
    const profiles = await calculateCategoryRiskProfiles(patterns);
    const impacts = await analyzeCrossCategoryImpacts(patterns);
    const summary = await generateRiskPortfolioSummary(profiles, patterns, impacts);

    return {
        patterns: Object.fromEntries(patterns),
        profiles: Object.fromEntries(profiles),
        impacts: Object.fromEntries(impacts),
        summary,
    };
}
