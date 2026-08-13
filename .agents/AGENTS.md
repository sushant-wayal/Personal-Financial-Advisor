# Global Agent Instructions — Personal Financial Advisor

This repository is a production personal financial management system consisting of a Next.js 16 (App Router) web application and an Expo Router (v6) mobile application powered by a shared TypeScript domain layer, PostgreSQL database via Prisma ORM, Upstash Redis for real-time status, and Google Gemini API for an autonomous AI advisor.

All AI coding agents operating on this repository must strictly adhere to the following principles, workflows, and quality standards.

---

## 1. Mandatory Dual-Platform Feature Requirement (Web + Mobile)

**CRITICAL REQUIREMENT**: When requested to build, extend, or modify any user-facing feature or capability, agents MUST implement it for **BOTH** the Web Application (`app/`) **AND** the Mobile Application (`mobile/src/app/`), UNLESS the user request explicitly specifies that the feature is intended for only one platform.

* **Shared Domain Logic**: Place all calculations, data transformations, and business rules in domain services (`src/services/`) so both platforms share identical underlying logic.
* **Web Implementation**: Implement web pages, components, and TanStack Query state under `app/` and `components/`.
* **Mobile Implementation**: Implement mobile screens, navigation, and components under `mobile/src/app/` and `mobile/src/components/`.

---

## 2. Repository Understanding

Before implementing or modifying code:

1. **Inspect Relevant Files**: Locate entry points, domain services (`src/services/`), API routes (`app/api/`), components (`app/`, `components/`, `mobile/src/`), types (`src/types/`, `mobile/src/types/`), and Prisma schema (`prisma/schema.prisma`).
2. **Understand Existing Architecture**: Trace control and data flows across the system (UI → API/App → Domain Service → Prisma Data Access → PostgreSQL).
3. **Audit Before Creation**: Search the codebase for existing utilities (`src/services/shared/`), hooks, types, and components before creating new ones. Never duplicate logic.
4. **Inspect Database Models**: Check Prisma schemas, relations, default values, and migration history before touching data access code.
5. **Check Existing Tests**: Inspect Vitest test files (`*.test.ts`) in `src/services/` and `lib/` to understand expected behavior and boundary coverage.
6. **Never Guess Implementation Details**: Always view source files to verify function signatures, type definitions, and business logic before making changes.

---

## 3. Preserve Existing Functionality

The current codebase is the single source of truth for business rules and application behavior.

* **Preserve Behavior**: Do not modify existing working behavior unless explicitly instructed by the user request.
* **Minimal Scope**: Prefer the smallest correct change that addresses the task. Avoid broad rewrites.
* **No Unsolicited Refactoring**: Do not rewrite working modules, alter design patterns, or swap underlying libraries simply because a different style is preferred.
* **Reuse Existing Abstractions**: Utilize established helpers (`formatCurrency`, `clamp`, `daysBetween`, `calculateBurnRate`, etc.) rather than reinventing them.

---

## 4. Code Quality & Modularity

* **Strong TypeScript Typing**: Maintain full strictness (`strict: true`). Avoid `any`, non-null assertions (`!`), or unsafe type casts unless strictly necessary and documented.
* **Focused Functions**: Keep functions short, single-purpose, and cohesive.
* **Separation of Concerns**: Keep business math and financial logic inside domain services (`src/services/`). Never embed financial calculations directly inside React/React Native components or API route wrappers.
* **Explicit Error Handling**: Handle loading, empty, invalid, and error states. Never silently swallow exceptions or return fake fallback values that obscure bugs.
* **Responsibility-Driven Organization**: When a file grows too large or mixes unrelated concerns, extract clean, cohesive modules. Do not split files arbitrarily by line count.

---

## 5. CRITICAL LINTING REQUIREMENT (Non-Negotiable)

**All code changes MUST be completely free of linting errors AND linting warnings.**

After making any code changes:

1. Run the repository lint command:
   ```bash
   npm run lint
   ```
2. Fix **every** lint error.
3. Fix **every** lint warning (including unused variables, missing imports, implicit types, hook warnings).
4. Re-run `npm run lint` to verify a clean result.
5. Do NOT consider any task complete while any lint error or warning remains.
6. Do NOT add `eslint-disable` comments or disable rules to bypass warnings unless explicitly authorized and justified.

---

## 6. Type Safety

* Run TypeScript type checking to confirm zero diagnostic errors:
  ```bash
  npx tsc --noEmit
  ```
* Resolve all type errors introduced by code changes.
* Do not weaken types (e.g., using `any`, `unknown` without guard, or loose `Record<string, any>`) to bypass compiler checks.

---

## 7. Testing Requirements

* **Test Surface Identification**: Identify affected business logic, services, API routes, or components.
* **Financial Logic Coverage**: Test normal cases, boundary conditions, zero surplus/balances, negative values, exact thresholds, fully/partially funded states, and invalid inputs.
* **Bug Fix Workflow**:
  1. Reproduce the failure with an explicit test case or trace.
  2. Fix the underlying root cause (never mask symptoms).
  3. Add or update regression tests.
  4. Run tests using Vitest:
     ```bash
     npm run test
     ```

---

## 8. Financial Safety

Financial logic directly impacts user data, calculations, and recommendations.

Agents MUST NEVER:
* Invent or fabricate financial balances, income, expenses, or interest rates.
* Silently alter funding allocation priorities or spillover rules.
* Change rounding rules or introduce floating-point inaccuracies into monetary calculations.
* Modify core financial formulas without checking all downstream consumers (web dashboard, mobile app, AI advisor tools).
* Generate AI recommendations based on stale, hardcoded, or mocked numbers.
* Silently mutate the schema or semantic meaning of stored financial records.

Before changing financial calculations:
1. Inspect source data and existing formulas in `src/services/`.
2. Trace calculation flow from database through service to UI/Advisor.
3. Verify test coverage and edge cases.

---

## 9. Database Safety

All persistence uses Prisma ORM connected to PostgreSQL (`prisma/schema.prisma`).

Before altering database logic or schema:
* Inspect schema models, relationships, default values, and indexes.
* Avoid destructive migration steps (dropping tables, deleting columns, changing column types destructively).
* Maintain backward compatibility for existing persisted records.
* Never casually rename or drop fields in production models (`Transaction`, `Goal`, `FinancialProfile`, `InvestmentSuggestion`, `Category`, etc.).
* Stop and request explicit user confirmation before running any migration command that could destroy data.

---

## 10. Architecture & Layers

Maintain the established 4-tier layer boundary:

```text
Presentation Layer (Web: app/ | Mobile: mobile/src/app/)
       ↓
API / Action Layer (app/api/ | HTTP Endpoints)
       ↓
Domain Services Layer (src/services/<domain>/)
       ↓
Data Access Layer (src/lib/prisma.ts | Prisma ORM)
       ↓
Database (PostgreSQL)
```

* **Rule 1**: Business logic must reside in `src/services/`, serving both Web API routes and Mobile background endpoints.
* **Rule 2**: Domain services must remain decoupled from Next.js HTTP request/response objects (`NextRequest`, `NextResponse`).
* **Rule 3**: Web UI components reside in `app/` and `components/ui/`; Mobile UI components reside in `mobile/src/components/`.
* **Rule 4 (Dual-Platform)**: Every user-facing feature MUST be implemented across BOTH Web (`app/`) and Mobile (`mobile/src/app/`) unless specified otherwise.

---

## 11. Agent Behavior & Decision Making

* **Straightforward Tasks**: Investigate files → Design minimal change → Implement → Test & Lint → Report concise summary. Do not ask unnecessary questions.
* **Low-Risk Ambiguities**: Make the most reasonable choice aligned with existing codebase conventions.
* **High-Risk Triggers**: Stop and request user clarification ONLY when a decision materially impacts:
  - Financial calculation rules or funding allocation precedence
  - Database schema integrity or persistent data loss
  - Security, authorization, or API secrets
  - Core system architecture or new third-party dependencies

---

## 12. Definition of Done Checklist

A task is complete ONLY when all of the following criteria are met:

- [ ] Implementation addresses the core requirement correctly.
- [ ] Feature is implemented on **BOTH Web and Mobile** (unless explicitly scoped to one).
- [ ] Existing behavior and unaffected features remain fully intact.
- [ ] TypeScript check passes with 0 errors (`npx tsc --noEmit`).
- [ ] Linter check passes with **0 errors and 0 warnings** (`npm run lint`).
- [ ] Relevant Vitest unit tests pass (`npm run test`).
- [ ] Git diff has been reviewed to ensure no accidental changes, debug code, or temporary files remain.
- [ ] No unnecessary npm packages or external dependencies were added.
- [ ] Financial calculation edge cases (zero, negative, overflow, rounding) were verified.