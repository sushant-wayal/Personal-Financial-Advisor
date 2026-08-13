# Feature Development Skill

## Purpose

Define a disciplined, layer-aware workflow for introducing new capabilities or extending existing features in the **Personal Financial Advisor** system across **BOTH Web (`app/`) and Mobile (`mobile/src/app/`)** without introducing regressions, lint errors, or architectural churn.

---

## Mandatory Dual-Platform Requirement

When requested to build, modify, or extend any user-facing feature, agents MUST implement the feature for **BOTH the Web Application (`app/`) AND the Mobile Application (`mobile/src/app/`)**, UNLESS the user request explicitly specifies that the feature is intended for only one platform.

---

## When to Use

Use this skill whenever:
* Adding new user-facing functionality on Web or Mobile.
* Extending domain services (e.g., adding a new goal strategy, extending transaction categorizers, adding AI advisor DB tools).
* Introducing new API endpoints or database models.

---

## Feature Development Workflow

Follow this 10-step execution pipeline:

```text
Understand Requirement & Platform Scope
        ↓
Inspect Existing Implementation & Callers
        ↓
Identify Affected Layers (Domain Service, Schema, API, Web UI, Mobile UI)
        ↓
Design Smallest Correct Dual-Platform Change
        ↓
Implement Domain Logic & API Handler (Services first, API second)
        ↓
Implement Web UI (`app/`) AND Mobile UI (`mobile/src/`)
        ↓
Add / Update Vitest Unit Tests
        ↓
Run Linter & Resolve All Errors/Warnings (npm run lint)
        ↓
Run Type Checking (npx tsc --noEmit)
        ↓
Review Git Diff & Verify Feature on Both Platforms
```

---

## Layer-by-Layer Implementation Protocol

### 1. Schema & Migration Layer (if model changes needed)
- Update `prisma/schema.prisma`.
- Ensure new fields have sensible defaults or are optional (`?`).
- Run `npx prisma generate`.

### 2. Domain Service Layer (`src/services/`)
- Place core financial calculations, allocation algorithms, or business rules in `src/services/<domain>/`.
- Use canonical helpers from `src/services/shared/` (`formatting.ts`, `dates.ts`, `math.ts`).
- Keep functions pure and testable. Both Web API routes and Mobile endpoints share these services.

### 3. API Layer (`app/api/`)
- Add or update route handlers in `app/api/<feature>/route.ts`.
- Validate input payloads with Zod schemas where appropriate.
- Call domain services to execute business logic.
- Return standard JSON responses consumed by both Web and Mobile API clients.

### 4. Presentation Layer — Dual Platform Execution
- **Web (`app/`, `components/`)**:
  - Build server components or client components using TanStack Query for state management.
  - Apply Tailwind CSS v4 styling matching dark glassmorphism aesthetic.
  - Implement explicit loading, empty, and error states.
- **Mobile (`mobile/src/`)**:
  - Implement mobile screens in `mobile/src/app/` using Expo Router.
  - Modularize cards and modals under `mobile/src/components/`.
  - Use `useCurrency()` hook for formatting.
  - Handle mobile navigation and bottom sheet interactions cleanly.

---

## Key Rules

1. **Dual-Platform Parity**: Implement every feature for BOTH Web and Mobile unless explicitly told otherwise.
2. **Do Not Rewrite Unrelated Code**: Limit changes strictly to files required for the feature.
3. **Reuse Existing Patterns**: Follow established service function patterns, API structures, and UI components.
4. **Keep Feature Logic Cohesive**: Ensure domain services own the business logic, not UI components.
5. **Preserve Existing Behavior**: Ensure existing API contracts and service return types remain compatible.
6. **Handle Edge & Empty States**: Always implement empty state fallbacks (e.g., zero transactions, no goals created, empty budget limits).
7. **Add Unit Tests**: Cover new service functions with Vitest tests in `src/services/`.

---

## Common Mistakes to Avoid

* Implementing a feature ONLY on Web while neglecting Mobile (or vice versa).
* Writing business logic directly inside Next.js page components or Expo Native screens.
* Hardcoding INR formatting strings instead of using `formatCurrency()` (Web) or `useCurrency()` (Mobile).
* Forgetting to update mobile API clients when modifying web API response structures.
* Leaving unused imports, variables, or debug `console.log` statements in the code.

---

## Completion Criteria

A feature is complete ONLY when:
1. Feature is implemented on **BOTH Web (`app/`) and Mobile (`mobile/src/app/`)** (unless explicitly scoped to one).
2. Domain service logic is pure and shared.
3. `npm run lint` passes with **0 errors and 0 warnings**.
4. `npx tsc --noEmit` passes with 0 errors.
5. Vitest tests pass cleanly (`npm run test`).
6. Loading, empty, error, and success states are handled on both platforms.
