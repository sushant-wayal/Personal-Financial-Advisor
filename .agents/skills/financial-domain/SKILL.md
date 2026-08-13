# Financial Domain Skill

## Purpose

Document the **ACTUAL financial concepts, domain models, relationships, business invariants, domain barrels, and sources of truth** present in the **Personal Financial Advisor** repository.

This skill serves as the definitive domain knowledge reference for AI agents modifying financial calculations, goal engines, emergency fund safety nets, investment suggestions, asset tracking, or AI advisor features.

---

## Source of Truth Architecture & Domain Barrels

All financial concepts derive their state directly from PostgreSQL via Prisma models (`prisma/schema.prisma`) and domain calculation services (`src/services/`).

Domain services are grouped into barrel index files under `src/services/<domain>/index.ts` for cohesive importing:

- **Transactions Barrel** (`src/services/transactions/index.ts`): Parsing (`transactionParser.ts`), ingestion (`transactionIngestion.ts`), transactions (`transactions.ts`), categorizer (`categorizer.ts`), subscription detection (`subscriptionDetector.ts`), balance (`balance.ts`).
- **Goals Barrel** (`src/services/goals/index.ts`): CRUD (`goals.ts`), progress (`goalProgress.ts`), allocation (`GoalAllocationService.ts`), feasibility (`GoalFeasibilityService.ts`), forecast (`GoalForecastService.ts`), timeline (`GoalTimelineService.ts`), advice (`GoalAdvisorService.ts`), insights (`GoalInsightService.ts`).
- **Investments Barrel** (`src/services/investments/index.ts`): Investment engine & surplus (`investmentEngine.ts`), what-if scenarios (`WhatIfService.ts`).
- **Analytics Barrel** (`src/services/analytics/index.ts`): Monthly trends & burn rate (`analytics.ts`), behavior (`behavior.ts`), prediction (`prediction.ts`), savings (`savings.ts`), risk volatility (`RiskVolatilityService.ts`).
- **Gmail Integration Barrel** (`src/services/gmail/index.ts`): OAuth & API (`gmail.ts`), history (`gmail-history.service.ts`), watch push (`gmail-watch.service.ts`), webhook processing (`gmail-webhook.service.ts`), sender filter (`gmail-sender-filter.ts`), mutual fund webhooks (`mutual-fund-webhook.service.ts`), stock webhooks (`stock-webhook.service.ts`).
- **AI Advisor Barrel** (`src/services/advisor/index.ts`): Agentic loop (`advisorAgenticLoop.ts`), DB tools (`advisorDbTools.ts`), Gemini API client (`gemini.ts`), context builder (`aiContext.ts`), artifact parser (`advisorArtifacts.ts`), goal advice (`AIGoalAdvisorService.ts`).

---

## Core Financial Concepts & Domain Models

### 1. Financial Profile (`FinancialProfile`)
- **Source of Truth**: `prisma.financialProfile`
- **Key Fields**:
  - `balance`: Total liquid bank balance (INR).
  - `emergencyFund`: Saved emergency fund balance.
  - `emergencyFundMonths`: Target coverage in months (default 6, minimum 3).
  - `monthlyIncome`: Target monthly gross income.
  - `monthlyExpenses`: Target monthly expenses.
  - `efStrategy`: Preset strategy (`BALANCED` | `AGGRESSIVE_EF` | `ACCELERATED_GOALS` | `STRICT`).
  - `salaryCycleDays`: Days between salary credits (clamped between 30 and 33, default 33).
  - `autoSalaryCycle`: Boolean auto-detection flag.
  - Phase Investable Rates: `crisisInvestableRate` (0%), `efBuildingInvestableRate` (15%), `wealthBuildingInvestableRate` (100%), `goalSprintInvestableRate` (40%).
  - Sub-Allocations: Standard equity/debt/gold ratios (`stdEquityPct`: 70, `stdDebtPct`: 20, `stdGoldPct`: 10) and Conservative ratios (`consEquityPct`: 30, `consDebtPct`: 60, `consGoldPct`: 10).
  - Equity Breakdown: `equityNifty50Pct` (60%), `equityNiftyNext50Pct` (20%), `equityMidcapPct` (20%).
  - `investmentStreak`: Consecutive cycle investment streak counter (resets if gap > 40 days).

### 2. Transactions & Categories (`Transaction`, `Category`, `CategoryBudget`)
- **Source of Truth**: `prisma.transaction`, `prisma.category`, `prisma.categoryBudget`
- **Key Fields**:
  - `amount`: Absolute numeric transaction value.
  - `merchant`: Counterparty or store name.
  - `categoryId` / `category`: Related category reference.
  - `type`: Direction (`CREDIT` | `DEBIT` | `TRANSFER`).
  - `transactionType`: Specific type classification (`SALARY`, `UPI`, `CARD`, `CREDITED`, `DEBITED`, `OTHER`, `PPF DEPOSIT`, etc.).
  - `timestamp`: Event occurrence date.
  - `source` & `sourceMessageId`: Bank SMS/Email origin tracking.
  - `isClubbed`, `clubbedSourceIds`: Bulk transaction grouping flags.
- **Business Invariants**:
  - `CREDIT` transactions increase bank balance; `DEBIT` transactions decrease bank balance.
  - `TRANSFER` transactions or categories named "bank" / "transfer" are self-transfers and MUST NOT be counted as income or expenses in surplus calculations.

### 3. Financial Goals (`Goal`)
- **Source of Truth**: `prisma.goal`
- **Key Fields**:
  - `title`: Goal name (e.g., "Emergency Fund", "New Car", "Vacation").
  - `targetAmount`: Target capital required.
  - `currentAmount`: Accumulated saved capital.
  - `monthlyTarget` / `recommendedMonthlyContribution`: Target monthly contribution.
  - `priority`: Integer priority scale from 1 (Highest) to 5 (Lowest), default 3.
  - `targetDate`: Target completion date.
  - `status`: `ACTIVE`, `COMPLETED`, or `ARCHIVED`.
- **Calculated Invariants**:
  - Unfunded requirement = `Math.max(0, targetAmount - currentAmount)`.
  - When `currentAmount >= targetAmount`, the goal is fully funded and requires 0 monthly allocation.

### 4. Emergency Fund (`emergencyFund.ts`)
- **Source of Truth**: Calculated dynamically by `getEmergencyFundStatus()` in `src/services/emergencyFund.ts`.
- **Key Metrics**:
  - `avgMonthlyExpenses`: 3-month rolling burn rate derived from actual transactions (`analytics.ts`), falling back to `profile.monthlyExpenses`.
  - `targetAmount`: `targetMonths × avgMonthlyExpenses`.
  - `savedAmount`: Liquid capital allocated to EF based on strategy ratio + surplus spillover from goals pool.
  - `shortfall`: `Math.max(0, targetAmount - savedAmount)`.
  - `isComplete`: `true` when `shortfall === 0`.
  - `efMonthlyDrip`: Monthly capacity dripping into EF based on safety tier ratios.
- **Safety Tiers**:
  - **Tier 1 (Starter)**: Triggered when `savedAmount < avgMonthlyExpenses` or `progressPct < 25%`. Allocates higher ratio to EF (e.g. 85-95%).
  - **Tier 2 (Core)**: Standard EF building phase (70-85% EF ratio).
  - **Tier 3 (Fully Funded)**: `isComplete === true`. EF drip drops to 0; 100% of non-investment capacity spills to goals/investments.

### 5. Surplus & Investment Engine (`investmentEngine.ts`)
- **Source of Truth**: `src/services/investmentEngine.ts` and `prisma.investmentSuggestion`
- **Calculated Surplus**:
  - `rawSurplus`: `grossIncome - totalExpenses` within salary cycle (clamped by current liquid balance).
  - `smoothedSurplus`: Weighted surplus = `Math.min(0.7 * rawSurplus + 0.3 * previousSurplus, currentBalance)`.
- **Financial Phases**:
  - `CRISIS`: `surplus <= 0` or runway < 1 month. Investable rate = 0%.
  - `EF_BUILDING`: Emergency Fund incomplete. Investable rate = 15% (default).
  - `GOAL_SPRINT`: EF complete but an imminent high-priority goal exists within 6 months. Investable rate = 40% (default).
  - `WEALTH_BUILDING`: EF complete and no imminent goal sprints. Investable rate = 100% (default).

### 6. Assets & Liabilities
- **Models**: `MutualFund`, `Stock`, `PPFAccount`, `EPFAccount`, `FDAccount`, `RDAccount`, `VehicleAsset`, `PlotAsset`, `IndependentPropertyAsset`, `ApartmentAsset`, `JewelleryAsset`, `ReceivableAsset`, `LoanLiability`, `CreditCardLiability`, `BnplLiability`, `BorrowedLiability`.

---

## Consumer Hierarchy & Data Dependencies

```text
Transactions & Income/Expense Events
       ↓
analytics.ts (Burn Rate, Monthly Capacity)
       ↓
emergencyFund.ts (EF Target, Saved Amount, Drip, Goal Capacity)
       ↓
GoalAllocationService.ts (Priority/Utility Goal Funding)
       ↓
investmentEngine.ts (Phase, Investable Surplus, Sub-Allocations)
       ↓
Web Dashboard / Mobile App / AI Advisor Tools
```

---

## Critical Rules for Agents Working in Financial Domain

1. **Never Invent Financial Values**: Never introduce hardcoded balances, income numbers, or return rates.
2. **Never Overwrite User Profiles Silently**: Do not alter `FinancialProfile` rates or strategies without explicit user action.
3. **Respect Self-Transfers**: Ensure transaction filters exclude `TRANSFER` types and "bank"/"transfer" categories from income/expense calculations.
4. **Preserve Rounding Integrity**: Use `formatCurrency()` for UI strings and explicit `Math.round()` for persistent balance updates.
5. **Verify All Consumers**: When modifying return shapes in `emergencyFund.ts`, `goals.ts`, or `investmentEngine.ts`, verify that API endpoints and AI advisor tools (`advisorDbTools.ts`) remain updated.
