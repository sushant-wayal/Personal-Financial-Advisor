# Explore Codebase Skill

## Purpose

Provide a systematic, repeatable method for exploring and understanding the **Personal Financial Advisor** codebase before attempting any bug fix, refactor, or feature implementation.

---

## When to Use

Use this skill:
* At the start of any non-trivial coding task.
* When working in an unfamiliar area of the codebase (e.g., AI Advisor agentic loop, transaction parsing pipeline, goal allocation engine, mobile Expo screens).
* Before making structural or architectural modifications.
* When tracing a bug across presentation, API, domain service, and database layers.

---

## Systematic Exploration Workflow

Follow this 10-step protocol to trace and map the system:

```text
1. Identify Entry Points
       ↓
2. Locate UI Components (Web & Mobile)
       ↓
3. Locate API / Route Handlers
       ↓
4. Locate Domain Services & Barrel Index Modules
       ↓
5. Locate Prisma Models & Schemas
       ↓
6. Locate Vitest Unit Tests
       ↓
7. Trace Data & Control Flow
       ↓
8. Search for Existing Implementations & Shared Helpers
       ↓
9. Identify Cross-Module Dependencies
       ↓
10. Summarize System Map & Proposed Touchpoints
```

### Step 1: Identify Entry Points
- **Web App**: `app/layout.tsx`, `app/page.tsx`, `middleware.ts`.
- **Mobile App**: `mobile/src/app/_layout.tsx`, `mobile/src/app/index.tsx`.
- **API Surface**: `app/api/**/route.ts`.

### Step 2: Locate UI Components
- **Web Pages & Views**: `app/transactions/`, `app/goals/`, `app/investments/`, `app/advisor/`, `app/analytics/`, `app/settings/`.
- **Web Design System**: `components/ui/` (shadcn/ui), `components/`.
- **Mobile Screens & Components**: `mobile/src/app/`, `mobile/src/components/transactions/`, `mobile/src/components/goals/`, `mobile/src/components/advisor/`, `mobile/src/lib/`, `mobile/src/providers/`, `mobile/src/types/`.

### Step 3: Locate API Route Handlers
- REST API handlers reside under `app/api/`:
  - Transactions: `app/api/transactions/route.ts`, `app/api/transactions/ingest/route.ts`
  - Goals: `app/api/goals/route.ts`, `app/api/goals/allocation/route.ts`
  - Emergency Fund: `app/api/emergency-fund/route.ts`
  - Investments: `app/api/investments/suggestion/route.ts`, `app/api/investments/history/route.ts`
  - AI Advisor: `app/api/ai/advisor/route.ts`, `app/api/ai/advisor/status/route.ts`

### Step 4: Locate Domain Services & Domain Barrels
- **Domain Services & Barrels (`src/services/`)**:
  - Transactions Barrel (`src/services/transactions/index.ts`): `transactionParser.ts`, `transactionIngestion.ts`, `transactions.ts`, `categorizer.ts`, `subscriptionDetector.ts`, `balance.ts`
  - Goals Barrel (`src/services/goals/index.ts`): `goals.ts`, `goalProgress.ts`, `GoalAllocationService.ts`, `GoalFeasibilityService.ts`, `GoalForecastService.ts`, `GoalTimelineService.ts`, `GoalAdvisorService.ts`, `GoalInsightService.ts`
  - Investments Barrel (`src/services/investments/index.ts`): `investmentEngine.ts`, `WhatIfService.ts`
  - Analytics Barrel (`src/services/analytics/index.ts`): `analytics.ts`, `behavior.ts`, `prediction.ts`, `savings.ts`, `RiskVolatilityService.ts`
  - Gmail Integration Barrel (`src/services/gmail/index.ts`): `gmail.ts`, `gmail-history.service.ts`, `gmail-watch.service.ts`, `gmail-webhook.service.ts`, `gmail-sender-filter.ts`, `mutual-fund-webhook.service.ts`, `stock-webhook.service.ts`
  - AI Advisor Barrel (`src/services/advisor/index.ts`): `advisorAgenticLoop.ts`, `advisorDbTools.ts`, `gemini.ts`, `aiContext.ts`, `advisorArtifacts.ts`, `AIGoalAdvisorService.ts`
- **Shared Helpers**: `src/services/shared/` (`formatting.ts`, `dates.ts`, `math.ts`).

### Step 5: Locate Prisma Models & Schemas
- Inspect `prisma/schema.prisma` for target entities:
  - Financial data: `Transaction`, `TransactionIngestionKey`, `Category`, `MerchantCategoryMap`, `CategoryBudget`
  - Goals & Profile: `Goal`, `FinancialProfile`
  - Investments: `InvestmentSuggestion`, `InvestmentHistory`
  - Assets & Liabilities: `MutualFund`, `Stock`, `PPFAccount`, `EPFAccount`, `FDAccount`, `RDAccount`, `VehicleAsset`, `PlotAsset`, `IndependentPropertyAsset`, `ApartmentAsset`, `JewelleryAsset`, `ReceivableAsset`, `LoanLiability`, `CreditCardLiability`, `BnplLiability`, `BorrowedLiability`

### Step 6: Locate Vitest Unit Tests
- Test files reside alongside services or in `lib/`:
  - `src/services/goalProgress.test.ts`
  - `src/services/investmentEngine.test.ts`
  - `src/services/balance.test.ts`
  - `src/services/analytics.test.ts`
  - `src/services/prediction.test.ts`
  - `lib/utils.test.ts`

### Step 7: Trace Data & Control Flow
- Trace requests end-to-end:
  `User Interaction → React Query / fetch → API Route → Domain Service → Prisma / Redis → Response → UI Update`

### Step 8: Search for Existing Implementations
- Use codebase search tools to find existing utilities before writing new ones (e.g., check `formatCurrency` in `src/services/shared/formatting.ts`).

### Step 9: Identify Cross-Module Dependencies
- Check if changing a domain service impacts other consumers (e.g., modifying `emergencyFund.ts` affects `getEmergencyFundStatus()`, which is called by web dashboard, mobile app, and `advisorDbTools.ts`).

### Step 10: Summarize Architecture
- Briefly outline findings and affected layers before editing any files.

---

## Exploration Rules

1. **Search Before Creating**: Always search the codebase for existing functions, constants, or types before implementing new ones.
2. **Reuse Before Duplicating**: Use shared utilities in `src/services/shared/` (`formatting.ts`, `dates.ts`, `math.ts`).
3. **Understand Before Modifying**: Never edit a service without viewing its full implementation and callers.
4. **Never Assume File Locations**: Use codebase search to confirm exact file paths.

---

## Common Mistakes to Avoid

* Modifying a service without checking all callers (e.g., breaking AI Advisor tools when changing a service return shape).
* Writing custom currency formatting instead of using `formatCurrency` from `src/services/shared/formatting.ts`.
* Adding duplicated math helpers instead of extending `src/services/shared/math.ts`.

---

## Completion Criteria

Exploration is complete when:
- All touchpoint files across UI, API, Domain Services, Barrels, and DB are identified.
- Data flow and dependencies are fully mapped.
- Existing reusable helpers have been cataloged.
