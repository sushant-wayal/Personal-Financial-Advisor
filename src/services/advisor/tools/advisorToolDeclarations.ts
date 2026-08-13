/**
 * advisorToolDeclarations.ts
 *
 * Declarations for tools available to the Gemini AI advisor.
 */

export const ADVISOR_TOOL_DECLARATIONS = [
    {
        name: "queryTransactions",
        description: "Fetch a filtered, paginated list of transactions from the database.",
        parameters: {
            type: "object",
            properties: {
                dateFrom: { type: "string", description: "Start date YYYY-MM-DD" },
                dateTo: { type: "string", description: "End date YYYY-MM-DD" },
                dateRange: { type: "string", enum: ["today", "last7", "last30", "last90", "this_month", "last_month", "all"] },
                merchant: { type: "string" },
                category: { type: "string" },
                type: { type: "string", enum: ["income", "expense", "credit", "debit"] },
                amountMin: { type: "number" },
                amountMax: { type: "number" },
                sortBy: { type: "string", enum: ["date", "amount", "merchant"] },
                sortDir: { type: "string", enum: ["asc", "desc"] },
                page: { type: "number" },
                limit: { type: "number" },
            },
        },
    },
    {
        name: "aggregateTransactions",
        description: "Compute aggregated spending metrics grouped by category, merchant, month, or type.",
        parameters: {
            type: "object",
            properties: {
                groupBy: { type: "string", enum: ["category", "merchant", "month", "type", "paymentMethod", "bankName"] },
                metric: { type: "string", enum: ["sum", "avg", "count"] },
                dateFrom: { type: "string" },
                dateTo: { type: "string" },
                dateRange: { type: "string" },
                type: { type: "string" },
                limit: { type: "number" },
            },
        },
    },
    {
        name: "queryGoals",
        description: "Fetch all financial goals with targets, status, and progress.",
        parameters: {
            type: "object",
            properties: {
                status: { type: "string" },
                priority: { type: "number" },
                limit: { type: "number" },
            },
        },
    },
    {
        name: "querySubscriptions",
        description: "Fetch active recurring subscriptions.",
        parameters: {
            type: "object",
            properties: {
                activeOnly: { type: "boolean" },
                limit: { type: "number" },
            },
        },
    },
    {
        name: "queryCategories",
        description: "Fetch all configured transaction category definitions.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "getFinancialProfile",
        description: "Fetch current financial profile summary.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "queryBudgets",
        description: "Fetch active category budget allocations.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "getInvestmentSuggestion",
        description: "Fetch current surplus and investment allocation suggestion.",
        parameters: { type: "object", properties: {} },
    },
];
