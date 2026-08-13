# Verify Before Done Skill

## Purpose

Define the **mandatory final verification workflow** that MUST be performed before declaring ANY coding task complete.

This verification protocol ensures that code changes are correct, type-safe, lint-free, test-backed, and free of unintended side effects or collateral damage.

---

## When to Use

Execute this workflow at the very end of EVERY task, right before presenting the final response to the user.

---

## Mandatory 8-Step Verification Workflow

```text
Step 1: Inspect Changed Files
        ↓
Step 2: Review Git Diff
        ↓
Step 3: Run Vitest Unit Tests (npm run test)
        ↓
Step 4: Run TypeScript Type Check (npx tsc --noEmit)
        ↓
Step 5: Run ESLint (npm run lint)
        ↓
Step 6: Ensure ZERO Lint Errors & ZERO Newly Introduced Lint Warnings
        ↓
Step 7: Audit Code Cleanliness & Hygiene
        ↓
Step 8: Verify Financial Edge Cases & Numerical Invariants
```

---

## Detailed Step Protocol

### Step 1: Inspect Changed Files
- Confirm that ONLY intended files inside appropriate directories were modified or created.
- Ensure NO files outside `.agents/` were touched if the task was strictly agent system creation.

### Step 2: Review Git Diff
- Inspect `git diff` output to verify every change line by line.
- Check for accidental edits, stray comments, temporary debug code, or formatting noise.

### Step 3: Run Vitest Unit Tests
- Execute test runner:
  ```bash
  npm run test
  ```
- Verify that 100% of tests pass. Fix any broken assertions immediately.

### Step 4: Run TypeScript Type Check
- Execute compiler check:
  ```bash
  npx tsc --noEmit
  ```
- Verify that 0 type errors exist. Do not use `any` or `@ts-ignore` to bypass type issues.

### Step 5: Run ESLint
- Execute linter:
  ```bash
  npm run lint
  ```

### Step 6: Verify ZERO Lint Errors and ZERO Newly Introduced Warnings
- **Errors**: Must be 0.
- **Warnings**: Must be 0 newly introduced warnings.
- If pre-existing warnings exist in untouched files, report them separately, but ALL newly touched code must be completely clean of warnings.
- Re-run `npm run lint` until clean.

### Step 7: Audit Code Cleanliness & Hygiene
Check for:
- [ ] Accidental file modifications or unneeded file additions
- [ ] Dead code, unused imports, or unused parameters
- [ ] Duplicated logic or math helpers
- [ ] Debug logging (`console.log`, `console.error`) left in production paths
- [ ] Unnecessary dependencies added to `package.json`
- [ ] Disabled lint rules (`eslint-disable`) or suppressed TypeScript checks
- [ ] Hardcoded financial amounts or currency symbols

### Step 8: Verify Financial Edge Cases & Numerical Invariants
For any financial, goal, investment, transaction, or emergency fund logic:
- Manually reason through boundary conditions:
  - Zero surplus / Zero bank balance
  - Negative values or expenses exceeding income
  - Exact goal target amounts (`currentAmount == targetAmount`)
  - Fully vs partially funded allocations
  - Missing dates or zero monthly capacity
- Confirm rounding rules (`Math.round`, `roundTo`) avoid floating-point drift.

---

## Non-Negotiable Rule

**NEVER declare a task complete before attempting and passing this verification workflow.**

If any step fails:
1. Fix the underlying issue.
2. Re-run the verification workflow from Step 3.
3. Only report completion once all 8 steps pass cleanly.

---

## Final Verification Checklist Summary

- [ ] Changed files reviewed
- [ ] Git diff clean
- [ ] Unit tests pass (`npm run test`)
- [ ] Type check clean (`npx tsc --noEmit`)
- [ ] Linter clean with **0 errors and 0 warnings** (`npm run lint`)
- [ ] Hygiene audit clean
- [ ] Financial invariants verified
