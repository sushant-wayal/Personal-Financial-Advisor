# Refactor Skill

## Purpose

Provide precise guidelines for improving code structure, readability, and modularity in the **Personal Financial Advisor** system WITHOUT altering external behavior, database schemas, or API contracts.

---

## When to Use

Use this skill when:
* Extracting reusable domain services from oversized files or API route handlers.
* Modularizing large components or long service functions into cohesive modules.
* Consolidating duplicate utilities into `src/services/shared/`.
* Improving TypeScript types and interfaces for better domain clarity.

---

## Non-Negotiable Refactoring Principles

1. **Behavioral Preservation Is Paramount**: External application behavior, API payloads, calculations, and UI displays MUST remain identical before and after refactoring.
2. **Establish Baseline First**: Before making any structural edits, run existing tests (`npm run test`) and type checks (`npx tsc --noEmit`) to establish a clean baseline.
3. **Refactor in Small Steps**: Make one structural change at a time (e.g., extract a helper, rename a type, move a sub-component), verifying after each step.
4. **Preserve Public Interfaces**: Do not change exported function signatures or API endpoints unless explicitly required.
5. **Responsibility-Driven Splitting**: Split files based on distinct logical responsibilities (e.g., separating transaction parsing from ingestion keys), NOT arbitrary line count limits.
6. **No Speculative Abstractions**: Do not create complex generic wrappers, design patterns, or class hierarchies for one-off operations. Prefer simple, explicit functions.

---

## Safe Refactoring Workflow

```text
Run Existing Tests & Type Check (Establish Baseline)
        ↓
Identify Specific Target Responsibility to Extract
        ↓
Create Cohesive Sub-module / Helper Function
        ↓
Update Invocation Sites
        ↓
Run Vitest Tests (Verify Behavior Unchanged)
        ↓
Run Type Checking (npx tsc --noEmit)
        ↓
Run Linter & Fix All Warnings (npm run lint)
        ↓
Review Git Diff (Verify Clean Minimal Edits)
```

---

## Architectural Boundaries to Maintain

During refactoring, strictly maintain the repository's layer boundaries:

```text
Presentation Layer (app/, mobile/src/)
       ↓
API Layer (app/api/)
       ↓
Domain Services (src/services/<domain>/)
       ↓
Data Access (src/lib/prisma.ts)
```

* **Do NOT move domain math from `src/services/` into React components.**
* **Do NOT import Next.js `NextRequest`/`NextResponse` into `src/services/`.**
* **Do NOT duplicate math or date helpers outside `src/services/shared/`.**

---

## Refactoring Examples in This Codebase

### Example 1: Extracting Tool Execution Logic
- *Before*: `advisorDbTools.ts` contained giant switch statements for all tool declarations and execution logic.
- *Refactored*: Tool definitions and execution handlers were modularized into `src/services/advisor/tools/` while `advisorDbTools.ts` re-exports the clean public surface for full backward compatibility.

### Example 2: Shared Math Helpers
- *Before*: `clamp()` and `safeDivide()` were defined inline inside individual calculation files.
- *Refactored*: Consolidated into `src/services/shared/math.ts` and reused across `GoalAllocationService.ts`, `investmentEngine.ts`, `emergencyFund.ts`, and `analytics.ts`.

---

## Common Refactoring Mistakes to Avoid

* Changing function return types or property names that cause mobile client or UI breaks.
* Adding speculative boilerplate abstractions (e.g., abstract factory classes for budget calculations).
* Splitting small 50-line files into 5 separate 10-line files.
* Disabling lint rules or ignoring TypeScript errors during refactoring.

---

## Completion Criteria

Refactoring is complete ONLY when:
1. Code readability, modularity, and single-responsibility are improved.
2. 100% of Vitest unit tests pass (`npm run test`).
3. TypeScript checks pass with 0 errors (`npx tsc --noEmit`).
4. Linter passes with **0 errors and 0 warnings** (`npm run lint`).
5. Git diff confirms zero behavioral or interface changes.
