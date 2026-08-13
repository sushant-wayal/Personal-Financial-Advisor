/**
 * Investments domain — barrel re-export.
 *
 * All investment-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { getOrGenerateInvestmentSuggestion } from "@/src/services/investments"
 *
 * For AI agents: this is the domain for salary cycle detection, surplus
 * computation, investment phase classification, sub-allocation (equity/debt/gold),
 * streak tracking, and what-if scenario analysis for investments.
 */
export * from "../investmentEngine";
export * from "../WhatIfService";
