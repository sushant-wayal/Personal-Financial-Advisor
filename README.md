# North : Personanl Financial Advisor

Local-first, single-user financial workspace built with Next.js, Prisma, SQLite, and Gemini. The app is designed to ingest financial emails and transaction text, normalize them deterministically, learn from corrections, and surface practical insights in one place.

## What it does

- Ingests financial emails and transaction snippets.
- Parses dates, amounts, merchants, and confidence scores with deterministic rules first.
- Categorizes transactions and stores learning hints in long-term AI memory.
- Shows a dashboard with goals, affordability checks, recurring subscriptions, and insight summaries.
- Streams AI advisor responses by default.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma + SQLite
- Tailwind CSS
- TanStack React Query
- Zustand
- Recharts
- Gemini API integration

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Generate the Prisma client and create the local database:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

See `.env.example` for the full list.

- `DATABASE_URL` - SQLite database path.
- `GEMINI_API_KEY` - required for AI advisor and streaming.
- `GEMINI_FLASH_MODEL` - optional model override for simple tasks (defaults to `gemini-2.5-flash`).
- `GEMINI_PRO_MODEL` - optional model override for complex analysis (defaults to `gemini-2.5-pro`).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Gmail OAuth credentials.
- `GOOGLE_REDIRECT_URI` - OAuth callback URL.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
npm run test:watch
npm run test:coverage
npm run prisma:generate
npm run prisma:migrate
```

## Testing

The repository includes Vitest-based unit tests.

```bash
npm test
```

Current tests cover the deterministic transaction parser. Add more tests under `tests/` as features evolve.

## Gmail Sync Flow

1. Configure Gmail OAuth in Google Cloud.
2. Set the OAuth variables in `.env`.
3. Authorize Gmail access through the app's OAuth flow.
4. Trigger synchronization through the Gmail sync route.

The sync pipeline stores last-sync state in AI memory and only uses AI when deterministic parsing is not enough.

## Project Structure

- `app/` - routes, pages, layouts, and UI composition.
- `src/services/` - parsing, categorization, AI, Gmail, insights, and analytics logic.
- `src/data/` - merchant dictionary data.
- `prisma/` - database schema.
- `tests/` - unit tests.

## Notes

- This app is intentionally local-first and single-user.
- AI is used for advisor-style responses and ambiguous cases, not as the primary source of truth.
- If you change schema files, rerun Prisma generation before starting the app.
