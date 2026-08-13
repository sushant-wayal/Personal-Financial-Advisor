# Advisor Engine Skill

## Purpose

Document the architecture, tool-calling mechanisms, Redis execution status loop, domain barrel index, and strict domain boundaries of the **AI Financial Advisor** in the **Personal Financial Advisor** system.

---

## AI Advisor Architecture

The AI Advisor uses Google Gemini API (`gemini.ts`) configured inside an **autonomous agentic loop** (`advisorAgenticLoop.ts`) supported by structured read/write database tools (`src/services/advisor/tools/`).

Domain services are re-exported via the advisor barrel index at `src/services/advisor/index.ts`.

```text
User Chat Request (`app/api/ai/advisor/route.ts`)
        ↓
advisorAgenticLoop.ts (Max 4 Iterations)
        ↓
LLM Call with Tool Declarations (`generateTextWithTools` in gemini.ts)
   ├── Status Update Pushed to Redis (`setAdvisorStatus` in redis.ts)
   └── Polled by Frontend (`/api/ai/advisor/status` & ChatClient.tsx / AdvisorOverlay.tsx)
        ↓
Execute Database Tool (`executeAdvisorTool` in advisorDbTools.ts & advisorExecutor.ts)
   ├── Read Tools: queryTransactions, aggregateTransactions, queryGoals, queryBudgets, getFinancialProfile, queryMemories, queryInsights
   └── Write Tools: addBudget, updateBudget, deleteBudget, addGoal, updateGoal, deleteGoal, addTransaction, updateTransaction, deleteTransaction, updateFinancialProfile
        ↓
Return Tool Output to LLM → Next Loop Iteration
        ↓
Final Response Produced → Parse Narrative & Visual Artifacts (`advisorArtifacts.ts`)
        ↓
Return Final JSON Response to Frontend
```

---

## Key Agentic Loop Components

### 1. Agentic Orchestration (`advisorAgenticLoop.ts`)
- Configured with `MAX_TOOL_ITERATIONS = 4`.
- On each iteration, if the LLM requests tool execution, `executeAdvisorTool()` runs the corresponding domain query or mutation.
- Keeps intermediate status in memory and writes formatted status messages to Redis (`pushStatus(requestId, status)`).

### 2. Redis Real-Time Status Polling (`src/lib/redis.ts`)
- Key format: `advisor:status:<requestId>`.
- Allows both Web (`app/advisor/ChatClient.tsx`) and Mobile (`mobile/src/components/advisor/AdvisorOverlay.tsx`) to show real-time progress indicators (e.g., "Fetching transactions (swiggy)...", "Reading financial goals").

### 3. Read-Only & Mutation Tool Definitions (`advisorDbTools.ts` & `src/services/advisor/tools/`)
- Tool implementations are modularized under `src/services/advisor/tools/`:
  - `advisorToolTypes.ts`: `ToolName`, `ToolCallRequest`, `ToolCallResult` types.
  - `advisorToolDeclarations.ts`: Zod/JSON schema tool declarations.
  - `advisorExecutor.ts`: Execution logic mapping tools to Prisma queries and domain service calls.
- `advisorDbTools.ts` re-exports the complete tool surface for backward compatibility.

### 4. Narrative & Artifact Parser (`advisorArtifacts.ts`)
- Parses structured UI widgets (charts, goal progress cards, budget bars) from the LLM's final response markdown into interactive React components on the frontend.

---

## Critical Rules for Advisor Development

### Rule 1: Reason strictly from Calculated Application Data
The AI Advisor MUST reason strictly from actual database data retrieved via tool calls or system context (`aiContext.ts`).

The advisor MUST NEVER fabricate or hallucinate:
* Account balances or liquid savings.
* Monthly income or expense totals.
* Emergency Fund shortfall or progress percentages.
* Goal completion dates or target amounts.
* Historical spending trends.

If an input is missing or empty (e.g. no budget configured for a category), the advisor MUST explicitly state that data is unavailable rather than inventing a number.

### Rule 2: Separate Deterministic Math from Probabilistic Language
- All financial calculations (burn rate, goal completion months, surplus allocation) MUST be performed deterministically by domain services (`src/services/`).
- The LLM's role is strictly to select queries, execute actions, and generate clear, empathetic narrative explanations and advice around calculated numbers.

### Rule 3: Maintain Backward Compatibility of DB Tools
When modifying or adding tools in `src/services/advisor/tools/`:
- Keep tool declaration names, descriptions, and argument schemas explicit and backward-compatible.
- Always handle missing optional tool arguments safely.

---

## Completion Criteria

Advisor engine changes are complete ONLY when:
1. Tool call declarations and execution handlers operate cleanly without Zod schema failures.
2. Redis status updates are published correctly at each step.
3. The LLM loop completes within 4 iterations.
4. `npx tsc --noEmit` and `npm run lint` report **0 errors and 0 warnings**.
