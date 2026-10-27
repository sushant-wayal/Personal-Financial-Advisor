# NORTH PROACTIVE FINANCIAL INTELLIGENCE: COMPLETE IMPLEMENTATION PLAN

## 1. Executive Summary & Objective

The goal of this system is to transition North from an **on-demand (reactive)** application to a **proactive, fully autonomous financial intelligence platform**.

### Core Requirements:
1. **Automated Daily Background Execution**:
   - Runs every morning in the background before market opening.
   - Pre-computes all recommendations across **Stocks**, **IPOs**, and **Monthly Mutual Funds**.
   - Results are already saved in the database before the user opens the application, ensuring **instantaneous, 0ms load times** on Web and Mobile.
2. **Proactive User Notifications (Zero In-App Storage)**:
   - When actionable suggestions exist, dispatch immediate notifications to the user.
   - **No notification database tables**: Eliminates the overhead of storing notifications, managing read/unread states, or building an in-app notification inbox.
   - The notification directs the user to open the respective app screen (`/stock-intelligence`, `/ipo-intelligence`, or `/investments`) where the pre-computed data is ready to view.

---

## 2. Daily Pipeline Architecture

```
                                ┌────────────────────────────────────────┐
                                │     MASTER BACKGROUND RUNNER (IST)     │
                                │   Every Weekday Morning at 09:15 AM    │
                                └───────────────────┬────────────────────┘
                                                    │
                   ┌────────────────────────────────┼────────────────────────────────┐
                   ▼                                ▼                                ▼
    ┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
    │   1. STOCK INTELLIGENCE      │ │     2. IPO INTELLIGENCE      │ │   3. MUTUAL FUNDS (MONTHLY)  │
    │ • Ingest latest NSE bars     │ │ • Sync live open IPOs        │ │ • Check salary/monthly cycle │
    │ • Detect Nifty macro regime  │ │ • Score QIB demand & GMP %   │ │ • Calculate investable rate  │
    │ • Run 3 swing strategies     │ │ • Select #1 Best Pick Today  │ │ • Allocate Nifty 50, Next50, │
    │ • Sized whole-share entries  │ │ • Determine Listing Strategy │ │   Midcap based on phase      │
    └──────────────┬───────────────┘ └──────────────┬───────────────┘ └──────────────┬───────────────┘
                   │                                │                                │
                   └────────────────────────────────┼────────────────────────────────┘
                                                    │
                                                    ▼
                                ┌────────────────────────────────────────┐
                                │       ACTIONABLE DECISION GATEWAY      │
                                │  Evaluate if suggestions exist:        │
                                │  • Stock: Any BUY or urgent SELL?      │
                                │  • IPO: Score >= 60 Best Pick active?  │
                                │  • MF: New monthly cycle SIP ready?    │
                                └───────────────────┬────────────────────┘
                                                    │
                                  ┌─────────────────┴─────────────────┐
                                  │ Actionable?                       │
                                  ├─────────────────┬─────────────────┤
                                  ▼ YES             ▼ NO
                     ┌────────────────────────┐  ┌──────────────────────┐
                     │  DISPATCH NOTIFICATION │  │  SILENT COMPLETION   │
                     │  • Mobile Push Alert   │  │  Log run status;     │
                     │  • Email / Webhook     │  │  no spam sent to     │
                     │  • Direct Deep-Links   │  │  the user.           │
                     └────────────────────────┘  └──────────────────────┘
```

---

## 3. Sub-Engine Cadence & Execution Details

### A. Stock Intelligence Engine (Daily Cadence)
- **Execution**: Daily on all trading days (Monday through Friday).
- **Process**:
  1. Synchronizes latest NSE price candles via `fetchUniverseData()`.
  2. Evaluates Nifty 50 regime (`detectMarketRegime()`).
  3. Checks personal capital allocation & drawdown circuit breaker (`calculateCapitalAllocation()`).
  4. Runs quantitative strategies (Trend Pullback, Momentum Breakout, Relative Strength).
  5. Evaluates portfolio holdings for trailing stop-loss or profit target triggers.
  6. Saves snapshot to `StockRecommendationRun` and `StockRecommendationItem`.
- **Notification Trigger**:
  - Triggers **ONLY** if $\ge 1$ **BUY** recommendation is generated with valid entry/stop levels, OR if an existing holding triggers an urgent **SELL** exit.
  - If 0 buys qualify (zero-forced-trade rule), it logs silently without pinging the user.

### B. IPO Intelligence Engine (Daily Cadence)
- **Execution**: Daily on all business days.
- **Process**:
  1. Synchronizes active Indian Mainboard & SME IPOs via `getOpenIpos()` and `ensureSeedIpos()`.
  2. Evaluates live institutional bidding demand (QIB subscription multiples) and Grey Market Premium (GMP % and trend).
  3. Calculates 100-point composite score ($35\%$ Demand + $30\%$ GMP + $20\%$ Valuation + $15\%$ Issue Quality).
  4. Sizes 1 retail lot at Cut-Off price based on personal surplus.
  5. Saves snapshot to `IpoRecommendationRun` and `IpoRecommendationItem`.
- **Notification Trigger**:
  - Triggers **ONLY** if an open IPO achieves a composite score $\ge 60$ and is designated as the **#1 Best Pick to Apply Today**.
  - If all open IPOs score below 60, the engine records `AVOID_ALL` and stays silent.

### C. Mutual Fund & Surplus Allocation Engine (Monthly Cadence)
- **Execution**: Evaluated daily, but generates actionable suggestions **once per monthly salary/investment cycle**.
- **Process**:
  1. Calls `detectSalaryCycle()` and `getOrGenerateInvestmentSuggestion()`.
  2. Checks if an active monthly suggestion already exists for the current cycle.
  3. If a new cycle has started (or it is the configured monthly allocation date):
     - Calculates total investable surplus based on financial phase (`EF_BUILDING`, `WEALTH_BUILDING`, `GOAL_SPRINT`).
     - Distributes equity across sub-allocations: Nifty 50 Index (60%), Nifty Next 50 (20%), and Midcap Index (20%).
     - Persists record in `InvestmentSuggestion`.
- **Notification Trigger**:
  - Triggers **ONLY ONCE per monthly cycle** when a new suggestion is created.

---

## 4. Notification Dispatch Architecture (No Database Storage)

Per your requirement, we do **not** store notifications in the database or build an in-app review inbox. The notification acts as an immediate push/dispatch channel:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NOTIFICATION DISPATCH SERVICE                         │
│                  `src/services/proactiveIntelligence/notifier.ts`           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
┌────────────────────────────────┐           ┌────────────────────────────────┐
│   CHANNEL 1: MOBILE PUSH       │           │   CHANNEL 2: EMAIL / WEBHOOK   │
│ • Uses Expo Push HTTP API      │           │ • Dispatches via Email/Webhook │
│ • Pops up on lock screen       │           │ • Clean morning briefing       │
│ • Direct tap navigates to:     │           │ • Formatted executive summary  │
│   - `/stock-intelligence`      │           │ • Links directly to web app    │
│   - `/ipo-intelligence`        │           │                                │
│   - `/investments`             │           │                                │
└────────────────────────────────┘           └────────────────────────────────┘
```

### Notification Message Templates:

#### 1. Daily Stock Alert (When BUY / SELL signals qualify):
> **Title**: 🎯 Stock Intelligence: 2 Swing Setups Ready
> **Body**: Buy setups identified for WAAREE (9 shares @ ₹1,503) & DIXON (1 share @ ₹13,200). Sized within your surplus limits with ATR stop-losses.
> **Action Route**: `/stock-intelligence`

#### 2. Daily IPO Alert (When #1 Best Pick qualifies):
> **Title**: 🚀 IPO Alert: Waaree Energies Open to Apply Today
> **Body**: Ranked #1 Best Pick (+98% expected listing gain, 27.8x QIB demand). Recommended: 1 Lot (9 shares @ ₹1,503 Cut-Off).
> **Action Route**: `/ipo-intelligence`

#### 3. Monthly Mutual Fund Alert (When monthly cycle triggers):
> **Title**: 💼 Monthly Investment Plan Ready
> **Body**: Your monthly surplus of ₹24,000 has been allocated across Nifty 50, Next 50, and Midcap index funds.
> **Action Route**: `/investments`

#### 4. Combined Multi-Engine Morning Briefing:
If both a Stock buy and an IPO pick qualify on the same morning, they can be merged into a single crisp alert:
> **Title**: ☀️ North Morning Briefing: Actions for Today
> **Body**: 1 Top IPO to apply (Waaree Energies, +98% GMP) & 1 Stock Swing setup ready. Pre-calculated and waiting in your app.

---

## 5. Domain Implementation Specifications

```
src/services/
└── proactiveIntelligence/
    ├── index.ts                # Master daily orchestrator (MF + Stock + IPO)
    ├── notifier.ts             # Direct push & email dispatch utility
    └── types.ts                # Actionable summary and trigger definitions
```

### Module Responsibilities:

#### 1. `src/services/proactiveIntelligence/index.ts`
- `runDailyProactiveIntelligence(options?: { forceNotify?: boolean })`:
  - Step 1: Ingests market data and runs `generateDailyRecommendations({ forceRerun: true })`.
  - Step 2: Syncs IPO catalog and runs `generateDailyIpoRecommendations({ forceRerun: true })`.
  - Step 3: Checks `getOrGenerateInvestmentSuggestion()`.
  - Step 4: Analyzes results to extract actionable triggers:
    ```typescript
    const hasStockAction = stockRun.recommendations.some(r => r.type === "BUY" || r.type === "SELL");
    const hasIpoAction = ipoRun.bestPick !== null && ipoRun.bestPick.score.totalScore >= 60;
    const hasMfAction = isNewMonthlyCycleGenerated;
    ```
  - Step 5: If any action is present, calls `sendProactiveNotification()`.

#### 2. `src/services/proactiveIntelligence/notifier.ts`
- Direct dispatch functions:
  - `sendMobilePushNotification(payload: NotificationPayload)`: Calls Expo Push API endpoint (`https://exp.host/--/api/v2/push/send`) using mobile push tokens.
  - `sendEmailNotification(payload: NotificationPayload)`: Dispatches via configured SMTP / Webhook / Gmail integration.
  - Formats clean markdown/text and attaches deep-link target paths.

---

## 6. Background Scheduling & Trigger Mechanisms

How does the server execute this proactively every morning?

### Option A: Cloud Production Scheduling (Vercel Cron)
Add the master endpoint to `vercel.json`:
```json
{
  "path": "/api/cron/proactive-intelligence",
  "schedule": "15 3 * * 1-5"
}
```
*(Runs at 03:15 UTC = 08:45 AM IST every weekday, 30 minutes before Indian market pre-open).*

### Option B: Built-In Node.js Background Interval (Self-Healing / Local Dev)
For local development or dedicated servers:
- A background ticker checks every 30 minutes if the current IST session date has already been processed in `StockRecommendationRun` and `IpoRecommendationRun`.
- If the clock passes 09:00 AM IST and today has not yet executed, it automatically kicks off `runDailyProactiveIntelligence()`.

---

## 7. Testing & Quality Assurance Plan

1. **Vitest Unit Tests** (`src/services/proactiveIntelligence/proactiveIntelligence.test.ts`):
   - Verifies that `runDailyProactiveIntelligence()` correctly coordinates all three engines.
   - Verifies notification suppression when no actionable setups exist (Zero spam rule).
   - Verifies notification dispatch when a qualifying Stock buy or Best IPO pick exists.
   - Verifies monthly throttling for mutual fund alerts (ensures MF alert triggers at most once per 30-day cycle).
2. **Quality Standards**:
   - `npx tsc --noEmit` — 0 TypeScript compiler errors.
   - `npm run lint` — 0 errors, 0 warnings.
   - `npm run test` — all Vitest suites pass.
