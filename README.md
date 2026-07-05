# North: Personal Financial Advisor

A robust, local-first, single-user financial workspace built with Next.js, Prisma, and Google Gemini. North is designed to be a highly intelligent personal finance companion. It goes beyond simple dashboards by ingesting financial emails and transaction text, deterministically parsing them, learning from user corrections, and featuring a conversational AI advisor that can proactively query your database to answer complex financial questions.

## Table of Contents
1. [Core Features](#core-features)
2. [Tech Stack](#tech-stack)
3. [Architecture Deep Dive](#architecture-deep-dive)
    - [Data Models](#data-models)
    - [Transaction Ingestion Pipeline](#transaction-ingestion-pipeline)
    - [AI Agentic Advisor Loop](#ai-agentic-advisor-loop)
    - [Categorization Engine](#categorization-engine)
4. [Project Structure](#project-structure)
5. [Mobile Companion App](#mobile-companion-app)
6. [Getting Started](#getting-started)
7. [Environment Variables](#environment-variables)
8. [Available Scripts](#available-scripts)
9. [Testing](#testing)

---

## Core Features

- **Intelligent Transaction Ingestion**: Accepts both structured data and raw text (e.g., bank email receipts). It uses a deterministic parser first, followed by AI-assisted categorization. It intelligently avoids duplicates using message ID fingerprinting.
- **Agentic AI Advisor**: A multi-turn, interactive Gemini-powered AI advisor. It doesn't just chat; it uses "tools" to query your SQLite/PostgreSQL database in real-time to analyze your spending, goals, and subscriptions before answering.
- **Goal Tracking & Feasibility**: Set financial goals. The app continuously calculates feasibility, tracks progress, and adjusts based on real-time balance and incoming transactions.
- **Smart Subscription Detection**: Automatically identifies recurring patterns and subscriptions, tracking intervals and predicting next charge dates.
- **Long-Term AI Memory**: Stores categorization overrides and user preferences in an `AIMemory` table, ensuring the system learns and improves its predictions over time.
- **Mobile Companion App**: A React Native (Expo) app included in the `mobile/` directory for on-the-go tracking.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Database**: SQLite (default) / PostgreSQL via [Prisma ORM](https://www.prisma.io/)
- **AI Integration**: Google Gemini API (`gemini-2.5-pro` and `gemini-2.5-flash`)
- **Styling**: Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com/), Framer Motion
- **State Management**: Zustand (Global state), TanStack React Query (Server state)
- **Data Visualization**: Recharts
- **Caching / Status**: Upstash Redis (used for real-time Agentic Loop status updates)
- **Mobile App**: Expo / React Native

---

## Architecture Deep Dive

### Data Models
The core of the application relies on a well-structured relational database (`prisma/schema.prisma`):
- **Transaction**: The central entity, containing amounts, merchants, confidence scores, and raw ingested text. Tracks `isClubbed` for grouping related transactions.
- **Category & MerchantCategoryMap**: Maps merchants to categories. Includes confidence scoring and handles manual overrides.
- **Goal**: Tracks financial goals, target amounts, and deadlines.
- **FinancialProfile**: Stores high-level metrics like emergency fund status, income, and overall balance.
- **AIMemory**: Key-value store for unstructured AI learnings.
- **Subscription & RecurringPattern**: Monitors fixed interval charges.
- **TransactionIngestionKey**: Manages idempotency during transaction ingestion to prevent double-counting.
- **GmailSender & GmailWatch**: Manages OAuth and webhooks for automated email receipt parsing.

### Transaction Ingestion Pipeline
Located in `src/services/transactionIngestion.ts`, this pipeline handles incoming financial data:
1. **Idempotency Check**: Generates a cryptographic hash (`TransactionIngestionKey`) based on amount, merchant, date, and source message ID. If a duplicate is found, the ingestion is skipped.
2. **Parsing**: If raw text is provided, `deterministicParse` extracts the merchant, amount, and type.
3. **Categorization**: Falls back to `autoCategorize` (AI) if the category isn't explicit or previously mapped.
4. **Side Effects**: Updating a transaction triggers downstream updates to `FinancialProfile` balance and triggers `adviseGoals` to recalculate goal feasibility.

### AI Agentic Advisor Loop
Located in `src/services/advisorAgenticLoop.ts`, this orchestrates a powerful multi-turn LLM loop:
1. **User Request**: The user asks a question (e.g., "Can I afford a new laptop?").
2. **Tool Calling**: The Gemini model is provided with database tools (`queryTransactions`, `queryGoals`, `aggregateTransactions`, etc.).
3. **Execution**: The model can iterate up to 4 times, querying the DB and analyzing results.
4. **Real-time Status**: Throughout the process, the loop pushes status updates to Redis (`StatusPhase: thinking -> querying -> processing -> done`). The frontend polls this via `/api/ai/advisor/status` to show a live progress UI.
5. **Final Response**: Returns a structured response comprising a Markdown narrative and actionable data artifacts.

### Categorization Engine
The system favors determinism over AI hallucinations:
- It first checks `MerchantCategoryMap` for known merchants.
- If unknown, it utilizes the Gemini API to categorize the transaction based on context.
- User corrections are saved, heavily weighting future categorization attempts.

---

## Project Structure

```text
.
├── app/                  # Next.js App Router (Pages, Layouts, API endpoints)
├── components/           # Reusable React components (shadcn/ui, custom UI)
├── lib/                  # Shared utilities, Prisma client instance, Redis client
├── mobile/               # Expo React Native companion application
├── prisma/               # Database schema (schema.prisma) and migrations
├── scripts/              # Database migration utilities (e.g., SQLite -> Postgres)
├── src/
│   ├── data/             # Static data sets or dictionaries
│   └── services/         # Core business logic (Ingestion, AI Loop, Parsing, Goals)
└── tests/                # Vitest unit test suites
```

---

## Mobile Companion App

The repository includes a mobile app built with Expo to provide on-the-go access.
- Located in the `/mobile` directory.
- Features file-based routing using Expo Router.
- **To start the mobile app:**
  ```bash
  cd mobile
  npm install
  npx expo start
  ```

---

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- A Google Gemini API Key
- (Optional) Upstash Redis URL for advisor status streaming
- (Optional) Google Cloud OAuth Credentials for Gmail sync

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Setup:**
   Create a `.env` file in the root directory (you can copy from `.env.example` if it exists):
   ```bash
   cp .env.example .env
   ```

3. **Database Setup:**
   Generate the Prisma client and run migrations to create the local SQLite database.
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## Environment Variables

Ensure the following variables are set in your `.env` file:

- `DATABASE_URL`: Connection string for the database (e.g., `file:./dev.db` or a Postgres URL).
- `GEMINI_API_KEY`: **Required** for AI advisor, categorization, and extraction.
- `GEMINI_FLASH_MODEL`: (Optional) Model for simple tasks. Defaults to `gemini-2.5-flash`.
- `GEMINI_PRO_MODEL`: (Optional) Model for complex reasoning. Defaults to `gemini-2.5-pro`.
- `GOOGLE_CLIENT_ID`: (Optional) For Gmail OAuth sync.
- `GOOGLE_CLIENT_SECRET`: (Optional) For Gmail OAuth sync.
- `GOOGLE_REDIRECT_URI`: (Optional) Callback URL for Gmail OAuth.
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`: (Optional, but recommended) Used for real-time status updates in the AI advisor loop.

---

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint.
- `npm test`: Runs Vitest test suites.
- `npm run test:watch`: Runs tests in watch mode.
- `npm run test:coverage`: Generates test coverage reports.
- `npm run prisma:generate`: Generates the Prisma Client.
- `npm run prisma:migrate`: Runs database migrations.
- `npm run prisma:studio`: Opens Prisma Studio to view database contents.
- `npm run db:migrate:sqlite-to-postgres`: Script to migrate data from local SQLite to PostgreSQL.

---

## Testing

North uses [Vitest](https://vitest.dev/) for unit testing, primarily focusing on the deterministic transaction parser and business logic.

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```
*Note: As features evolve, add new test suites within the `tests/` directory.*

---
*Built as a single-user, local-first intelligence workspace for your personal finances.*
