# Debugging Skill

## Purpose

Establish a strict, evidence-based, root-cause-first debugging protocol for investigating and resolving bugs across the **Personal Financial Advisor** system without guesswork, symptom-masking, or collateral breakage.

---

## When to Use

Use this skill whenever:
* A test fails during local execution (`npm run test`).
* An API route returns an unexpected 500 error or wrong payload.
* Financial calculations (burn rate, surplus, EF drip, goal timelines, investment allocation) produce incorrect numbers.
* The AI Advisor produces incorrect responses, fails tool execution, or gets stuck in Redis polling loops.
* Transaction ingestion produces duplicate records or misclassifies entries.

---

## Root-Cause-First Debugging Process

Follow this mandatory 8-step debugging workflow:

```text
Observe Failure (Logs / Stack Traces / Test Output)
        ↓
Reproduce Consistently (Minimal Test Case or Script)
        ↓
Trace Data & Control Flow (Source → Service → DB → UI)
        ↓
Pinpoint Divergence Point (Where expected vs actual split)
        ↓
Identify Root Cause (Why the contract or state broke)
        ↓
Implement Minimal Target Fix (Single precise fix)
        ↓
Add Regression Protection (Vitest assertion)
        ↓
Verify Fix, Types, and Lint Cleanliness
```

---

## Step-by-Step Debugging Execution Protocol

### Step 1: Read Full Error Logs & Stack Traces First
- Never guess why code failed. Always inspect the exact error traceback, Vitest output, or terminal log line.
- For API issues, check server console output or terminal response.

### Step 2: Reproduce the Issue
- Create a minimal Vitest test case or isolated execution script in `scratch/` to reproduce the exact failure deterministically.
- Verify that the issue reproduces consistently before attempting code edits.

### Step 3: Trace Data & Control Flow
- Follow inputs step-by-step through:
  `Input Payload → Validator → Service Method → Shared Helper → Prisma Query → Response Transformer`
- Print intermediate calculations or inspect variable states at each boundary.

### Step 4: Pinpoint Divergence
- Determine the exact line or helper where actual runtime state diverges from expected mathematical or logical output.

### Step 5: Identify True Root Cause
- Ask: *Is this caused by floating-point rounding errors? Stale cache in Redis? Missing null checks on Prisma optional relations? Unhandled transfer transaction types?*
- Do not settle for fixing symptoms. Fix the root contract flaw.

### Step 6: Implement Minimal Fix
- Modify only the specific logic responsible for the failure.
- Avoid changing unrelated files, refactoring surrounding code, or tweaking architecture while debugging.

### Step 7: Add Regression Protection
- Add a dedicated Vitest test case in the relevant `*.test.ts` file covering the exact bug condition (e.g., negative surplus, missing target date, self-transfer categorization).

### Step 8: Verify Complete Health
- Run `npm run test` to ensure all tests pass.
- Run `npx tsc --noEmit` to ensure no type regressions were introduced.
- Run `npm run lint` and resolve **all lint errors and warnings**.

---

## Prohibited Debugging Practices

Agents are STRICTLY PROHIBITED from engaging in:
1. **Random Patching**: Editing lines at random hoping the error disappears without understanding why.
2. **Symptom Masking**: Wrapping failing calls in empty `try { ... } catch { return []; }` or returning fake fallback numbers.
3. **Deleting or Disabling Tests**: Deleting failing test assertions or marking tests as skipped (`it.skip`) to fake a passing suite.
4. **Disabling Lint Rules**: Adding `eslint-disable` or `// @ts-ignore` to suppress errors caused by buggy types or unused variables.
5. **Architectural Rewrites During Debugging**: Rewriting an entire service or component when fixing a local logic bug.
6. **Adding Retries Without Understanding**: Wrapping unstable or buggy logic in retry loops without fixing the underlying race condition or logic bug.

---

## Common Bug Patterns in This Codebase

| Area | Typical Root Cause | Proper Diagnostic Action |
| :--- | :--- | :--- |
| **Goal Allocation** | Integer rounding sum mismatch (`allocated != totalCapacity`) | Inspect remainder distribution logic in `GoalAllocationService.ts`. |
| **Emergency Fund** | `burnRate` falling back to zero when no transactions exist | Check `calculateBurnRate()` fallback in `src/services/analytics.ts` and `emergencyFund.ts`. |
| **Investment Engine** | Streak reset failure due to date math exceeding 40 days | Inspect `calculateNextStreak()` and `daysBetween()` in `investmentEngine.ts`. |
| **Transaction Ingestion** | Duplicate transactions created from identical SMS webhooks | Check `buildTransactionIngestionKeys()` and `TransactionIngestionKey` table lookup in `transactionIngestion.ts`. |
| **AI Advisor Loop** | Redis status key stuck or tool arguments failing Zod parse | Check `advisorAgenticLoop.ts` iteration cap and `executeAdvisorTool()` in `advisorDbTools.ts`. |

---

## Completion Criteria

A bug fix is complete ONLY when:
1. The root cause is identified, explained, and fixed.
2. The fix is minimal and targeted.
3. A regression test exists and passes.
4. `npm run test` passes 100%.
5. `npx tsc --noEmit` passes with 0 errors.
6. `npm run lint` passes with **0 errors and 0 warnings**.
