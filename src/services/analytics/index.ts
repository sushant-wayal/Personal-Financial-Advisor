/**
 * Analytics domain — barrel re-export.
 *
 * All analytics-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { monthlyTrend, calculateBurnRate } from "@/src/services/analytics"
 *
 * For AI agents: this is the domain for monthly spend trends, category
 * breakdown, burn rate, savings rate, runway, seasonal patterns,
 * spending acceleration, and risk/volatility analysis.
 */
export * from "../analytics";
export * from "../behavior";
export * from "../prediction";
export * from "../savings";
export * from "../RiskVolatilityService";
