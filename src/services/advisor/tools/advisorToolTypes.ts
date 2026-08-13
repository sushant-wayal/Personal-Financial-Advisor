/**
 * advisorToolTypes.ts
 *
 * Types for AI Advisor database tools and execution results.
 */

export type ToolName =
    | "queryTransactions"
    | "aggregateTransactions"
    | "queryGoals"
    | "querySubscriptions"
    | "queryCategories"
    | "getFinancialProfile"
    | "queryMemories"
    | "queryInsights"
    | "addTransaction"
    | "updateTransaction"
    | "deleteTransaction"
    | "addGoal"
    | "updateGoal"
    | "deleteGoal"
    | "updateFinancialProfile"
    | "addSubscription"
    | "updateSubscription"
    | "deleteSubscription"
    | "addCategorizationRule"
    | "deleteCategorizationRule"
    | "getDatabaseSchema"
    | "writeDatabaseRecord"
    | "queryBudgets"
    | "addBudget"
    | "updateBudget"
    | "deleteBudget"
    | "getInvestmentSuggestion"
    | "getInvestmentHistory"
    | "updateInvestmentAllocations"
    | "markInvestmentCompleted";

export type ToolCallRequest = {
    name: ToolName;
    args: Record<string, unknown>;
};

export type ToolCallResult = {
    name: ToolName;
    data: unknown;
    error?: string;
};
