# Personal Financial Advisor — Architecture Guide

Welcome to the architecture documentation for the **Personal Financial Advisor** application. This document details the application's design principles, domain organization, data flow patterns, and architectural conventions for both the Web Application and the Mobile Expo App.

---

## 1. Overview & Tech Stack

This project is built using a twin-frontend architecture sharing backend services and database models:

### Web Frontend & Backend (`/app`, `/src`)
- **Framework**: Next.js 16.2.6 (App Router) with React 19 and TypeScript.
- **Styling**: Tailwind CSS v4 with custom dark mode glassmorphism UI.
- **Database**: PostgreSQL accessed via Prisma ORM (`prisma/schema.prisma`).
- **Client State & Data Fetching**: TanStack Query (v5), TanStack Table (v8), and Zustand.
- **AI Advisor**: Google Gemini API running an autonomous agentic loop with tool calls.
- **Background Jobs & Status**: Upstash Redis for polling and multi-turn AI execution state.
- **Testing**: Vitest with React Testing Library.

### Mobile Frontend (`/mobile`)
- **Framework**: Expo (v54), Expo Router (v6) with React 19 and React Native (v0.81.5).
- **Styling**: React Native StyleSheet with custom dark glass-effect design tokens.
- **State & Cache**: AsyncStorage client cache with custom polling and refresh controls.
- **Navigation**: Expo Router file-based navigation with safe area context and custom bottom sheets.

---

## 2. Directory Structure

```
app/                          # Next.js App Router (Pages & API routes)
  advisor/                    # AI Advisor interactive chat page & sub-components
  analytics/                  # Visual financial analytics & risk volatility breakdown
  api/                        # REST API handlers (/api/transactions, /api/goals, etc.)
  components/                 # Shared app-level layout & preview components
  goals/                      # Goal tracking, allocation engine & timeline components
  investments/                # Investment suggestions, history & allocation tweaking
  settings/                   # User profile, bank email integration & config
  transactions/               # Transaction table, bulk actions & filter components

mobile/                       # React Native Expo Mobile App
  src/
    app/                      # Expo Router mobile screens (index, transactions, goals, etc.)
    components/               # Mobile UI components & modals
      transactions/           # Transaction item cards & filter bottom sheets
      goals/                  # Mobile goal cards & emergency fund widgets
      advisor/                # Mobile AI advisor fab & overlay
    lib/                      # API base URL configuration & client cache
    providers/                # CurrencyProvider & App Contexts
    types/                    # Mobile TypeScript types (transaction.ts, goal.ts, advisor.ts)

components/ui/                # Canonical web shadcn/ui components (Card, Button, Dialog...)

src/
  lib/                        # Core infrastructure (prisma.ts, redis.ts, session.ts)
  config/                     # Static configuration defaults
  data/                       # Merchant dictionaries & transaction option lists
  providers/                  # Application React context providers (ReactQueryProvider)
  types/                      # Web & Shared Type definitions (transaction.ts, goal.ts, advisor.ts)
  
  services/                   # Application Domain Services
    shared/                   # Cross-cutting utilities (formatting, dates, math)
    transactions/             # Transaction parser, ingestion, categorization & balance
    goals/                    # Goal calculations, allocation engine, progress & timeline
    analytics/                # Monthly spending trends, behavior & risk analysis
    investments/              # Salary cycle detection, investment engine & scenarios
    advisor/                  # Gemini LLM client, agentic loop, tool declarations & context
    gmail/                    # Gmail OAuth, history sync & bank webhook processors
```

---

## 3. Key Design Conventions & Boundaries

### 3.1 Separation of Concerns
1. **App & Mobile Layer (`app/`, `mobile/src/app/`)**: Presentation layer for web & mobile.
   - Web uses Next.js App Router; Mobile uses Expo Router.
   - Both communicate with Next.js API routes (`app/api/**/route.ts`).
2. **Domain Services Layer (`src/services/`)**: Pure business logic layer.
   - Serves both Web API routes and Mobile background processing.
   - Never directly coupled to HTTP request/response objects (`NextRequest`/`NextResponse`).
3. **Shared Utilities (`src/services/shared/`)**:
   - `formatting.ts`: Canonical INR `formatCurrency` and percentage helpers.
   - `dates.ts`: Canonical date math (`monthsUntil`, `monthsSince`, `daysBetween`).
   - `math.ts`: Numeric helpers (`clamp`, `safeDivide`, `roundTo`).

### 3.2 AI Advisor Architecture
- **Location**: `src/services/advisor/`
- **Mechanism**: `advisorAgenticLoop.ts` executes up to 4 iterations of LLM tool calling via `generateTextWithTools` (Gemini API).
- **Read-Only Database Abstraction**: `advisorDbTools.ts` exposes structured tool definitions (`queryTransactions`, `queryGoals`, `queryBudgets`, etc.) so the AI advisor can autonomously query the financial database without SQL injection risks.
- **Real-Time Status**: Intermediate execution state (e.g., "querying transactions...") is pushed to Redis (`src/lib/redis.ts`) and polled by both `app/advisor/ChatClient.tsx` (web) and `mobile/src/components/advisor/AdvisorOverlay.tsx` (mobile).

---

## 4. Guidelines for Adding New Features

When extending the codebase:
1. **Financial Calculations**: Always place in a domain service under `src/services/<domain>/`. Do not write math directly inside React or React Native components.
2. **Formatting Currency**: On web, import `formatCurrency` from `@/src/services/shared/formatting`. On mobile, use `useCurrency()` hook or `getCurrencySymbol()`.
3. **Types**: Define new data transfer objects or domain models in `src/types/<domain>.ts` for web/shared, and `mobile/src/types/<domain>.ts` for mobile.
4. **Mobile Components**: Keep screen components in `mobile/src/app/` lightweight; delegate complex dialogs, bottom sheets, and cards into `mobile/src/components/<domain>/`.
