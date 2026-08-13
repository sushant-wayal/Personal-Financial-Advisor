# Code Review Skill

## Purpose

Provide a comprehensive code-review checklist for reviewing git diffs and code changes in the **Personal Financial Advisor** repository before considering any task complete.

---

## When to Use

Use this skill:
* During self-review of git diffs (`git diff`).
* Before declaring a coding task finished.
* When evaluating proposed refactors or feature changes.

---

## Code Review Checklist

Review every modified or created file against these 7 core criteria:

### 1. Correctness & Behavioral Preservation
- [ ] Does the change solve the exact user request without scope creep?
- [ ] Does existing application behavior remain completely intact?
- [ ] Are edge cases (empty lists, zero balances, missing dates) handled safely?
- [ ] Are API route response signatures preserved for both Web and Mobile clients?

### 2. Architecture & Layer Separation
- [ ] Is business logic located in domain services (`src/services/`) rather than React components or API routes?
- [ ] Are domain services independent of Next.js HTTP request/response objects?
- [ ] Are shared utilities (`formatting.ts`, `dates.ts`, `math.ts`) reused instead of duplicated?
- [ ] Does data flow cleanly: `UI → API Route → Domain Service → Prisma → Database`?

### 3. Maintainability & Code Quality
- [ ] Are functions focused, readable, and single-purpose?
- [ ] Are variable, function, and component names clear, descriptive, and domain-accurate?
- [ ] Is dead code, unused imports, or debug logging (`console.log`) removed?
- [ ] Are complex expressions broken down into named intermediate variables?

### 4. Financial Correctness & Numerical Precision
- [ ] Are monetary amounts handled accurately without floating-point precision loss?
- [ ] Is currency formatting applied using `formatCurrency` from `@/src/services/shared/formatting` on Web or `useCurrency()` on Mobile?
- [ ] Are percentage rates clamped between 0 and 100?
- [ ] Are goal funding priorities, spillover logic, and EF safety tiers strictly preserved?

### 5. Security & Input Validation
- [ ] Is user-provided data validated before processing or persisting?
- [ ] Are database operations parameterized via Prisma ORM (preventing SQL injection)?
- [ ] Are sensitive API keys (Gemini API, Redis credentials) read strictly from environment variables (`process.env`)?

### 6. Performance & Database Safety
- [ ] Are N+1 query patterns avoided (using Prisma `include`, `select`, or `findMany` with `in`)?
- [ ] Are database reads batched with `Promise.all` where independent queries run in parallel?
- [ ] Are database indexes, unique constraints, and non-destructive migrations respected?

### 7. Quality & Verification Standards
- [ ] Does `npx tsc --noEmit` report **0 errors**?
- [ ] Does `npm run lint` report **0 errors and 0 warnings**?
- [ ] Do all Vitest unit tests pass (`npm run test`)?
- [ ] Are newly introduced warnings or suppressed lint rules (`eslint-disable`) strictly zero?

---

## Red Flags — Reject Code If Found

Reject changes immediately if any of these red flags are present:
1. Business math written inside React/React Native components.
2. Floating-point division without fallback or zero-check.
3. Suppressed lint warnings using `eslint-disable` or `@ts-ignore`.
4. Hardcoded financial numbers or currency symbols.
5. Destructive Prisma schema modifications without explicit migration strategy.
6. Unused variables or unused imports remaining in any file.

---

## Completion Criteria

Code review is complete when every item in the checklist is satisfied and zero red flags exist in the git diff.
