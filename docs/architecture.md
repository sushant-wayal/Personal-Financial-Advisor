# Architecture Documentation — North Personal Financial Advisor

## System Overview

North is a dual-platform personal financial management system consisting of:
1. **Web Application**: Next.js 16 (App Router) with React 19, Tailwind CSS v4, shadcn/ui, TanStack Query, and Zustand.
2. **Mobile Application**: Expo Router v6 (React Native) with custom dark theme, gesture navigation, and native platform components.
3. **Domain Layer**: Shared TypeScript business logic (`src/services/`) shared conceptually between API routes and mobile endpoints.
4. **Data Access & Persistence**: PostgreSQL database accessed through Prisma ORM (`prisma/schema.prisma`).
5. **Real-Time State & Observability**: Upstash Redis for agentic loop execution phase reporting and caching.
6. **AI Autonomous Advisor**: Google Gemini API orchestrating multi-turn function calling over financial database models.

---

## Architecture Boundaries (4-Tier Architecture)

```text
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│   Web: app/ & components/  │  Mobile: mobile/src/app/  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                    Transport Layer                     │
│               app/api/ HTTP Route Handlers             │
│         (Input validation, JSON serialization)         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                  Domain Services Layer                 │
│               src/services/<domain>/                   │
│  (Pure business math, goal planning, stock intelligence,│
│       categorization, transaction ingestion)           │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Data Access Layer                    │
│           src/lib/prisma.ts (Prisma ORM Client)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                        Database                        │
│                   PostgreSQL Database                  │
└────────────────────────────────────────────────────────┘
```

---

## Core Domain Services

### 1. Goals & Capital Allocation Engine (`src/services/goals.ts`, `src/services/goalSpending.ts`)
- Calculates monthly required contributions and completion ETAs across competing priority goals.
- Enforces emergency fund drip ratios, spillover rules, and milestone tracking.
- Tracks spending against goals and computes resulting target amounts.

### 2. Transaction Ingestion & Deduplication (`src/services/transactionIngestion.ts`, `src/services/transactionParser.ts`)
- Computes SHA-256 idempotency keys (`TransactionIngestionKey`) over transaction metadata to guarantee zero double-counting.
- Deterministic regex parser extracts merchant, currency, amount, and payment method from raw text.
- Fallback AI categorizer maps unknown merchants to categories with confidence scores.

### 3. Agentic AI Advisor (`src/services/advisorAgenticLoop.ts`, `src/services/aiConversation.ts`)
- Implements Gemini function calling tools (`queryTransactions`, `queryGoals`, `aggregateTransactions`, `queryNetWorth`).
- Emits real-time execution phases (`thinking` → `querying` → `processing` → `done`) to Upstash Redis.
- Returns Markdown narratives with actionable structured artifacts (Goal, Budget, or Investment recommendations).

### 4. Stock & IPO Intelligence (`src/services/stockRecommendations/`, `src/services/ipoRecommendations/`)
- Multi-factor fundamental and technical scoring engine for Indian equities (NSE/BSE).
- Capital allocation engine factoring portfolio risk budget, volatility, and existing holdings.
- Exchange holiday calendar and market trading hours validation.

---

## Dual-Platform Synchronization

- Every user-facing feature exists on both Web (`app/`) and Mobile (`mobile/src/app/`).
- Mobile communicates with the Next.js API via `API_BASE_URL` (defined in `mobile/src/lib/apiBaseUrl.ts`).
- Types are shared and synchronized between `src/types/` and `mobile/src/types/`.

