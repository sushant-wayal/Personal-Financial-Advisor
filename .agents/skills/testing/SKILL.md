# Testing Skill

## Purpose

Define the testing conventions, test runner commands, and mandatory test coverage requirements for the **Personal Financial Advisor** repository.

---

## Testing Framework & Environment

* **Test Runner**: Vitest (`vitest`) with `@testing-library/react` and `jsdom` environment.
* **Configuration**: `vitest.config.mjs` with path alias `@/` mapping to project root.
* **Global Setup**: `test/setup.ts` loading `@testing-library/jest-dom`.

---

## Test Execution Commands

```bash
# Run all tests once
npm run test

# Run tests in watch mode during development
npm run test:watch

# Run tests with code coverage report
npm run test:coverage
```

---

## Priority Test Surfaces

When creating or modifying code, prioritize testing in this exact order:

1. **Financial Calculations & Allocation Engine**:
   - Priority-first, proportional, and utility goal allocation (`GoalAllocationService.ts`)
   - Emergency Fund status, safety tiers, and monthly drip calculations (`emergencyFund.ts`)
   - Surplus calculation, salary cycle detection, phase determination, sub-allocations, streak reset (`investmentEngine.ts`)
   - 3-month rolling burn rate and monthly runway calculations (`analytics.ts`)

2. **Transaction Processing & Ingestion**:
   - Deterministic SMS/Email transaction parsing (`transactionParser.ts`)
   - Categorization matching and merchant dictionary lookups (`categorizer.ts`)
   - Deduplication key generation (`buildTransactionIngestionKeys` in `transactionIngestion.ts`)
   - Balance impact calculation (`balance.ts`)

3. **Advisor Engine & Tools**:
   - AI Advisor DB tool declarations and tool execution outputs (`advisorDbTools.ts`)
   - Narrative & artifact parser (`advisorArtifacts.ts`)

4. **Shared Math & Date Utilities**:
   - `src/services/shared/math.ts` (`clamp`, `safeDivide`, `roundTo`)
   - `src/services/shared/dates.ts` (`daysBetween`, `monthsUntil`, `monthsSince`)
   - `src/services/shared/formatting.ts` (`formatCurrency`, `formatPercent`)

---

## Financial Boundary Testing Matrix

For EVERY financial calculation or allocation service change, test the following boundary conditions:

| Scenario | Test Condition | Expected Behavior |
| :--- | :--- | :--- |
| **Zero Surplus** | Income == Expenses or Balance == 0 | Allocation == 0; Phase == CRISIS; no negative drips. |
| **Negative Surplus** | Expenses > Income | Raw surplus floored at 0; no negative investment suggestions. |
| **Zero Balance** | Bank balance is 0 | EF saved amount == 0; goal capacity == 0. |
| **Exact Threshold** | `savedAmount == targetAmount` | `isComplete` becomes `true`; EF drip drops to 0; spillover moves to goals/investments. |
| **Below Threshold** | Progress < 25% or saved < 1 mo expense | Tier 1 (Starter) safety net triggers with higher EF allocation ratio. |
| **Above Threshold** | Progress >= 25% | Tier 2 (Core) safety net applies standard EF ratio. |
| **Fully Funded Goal** | `currentAmount >= targetAmount` | Unfunded goal requirement == 0; leftover goal pool spills to EF/investments. |
| **Partially Funded Goals** | `currentAmount < targetAmount` | Goal allocation divides monthly capacity based on selected strategy. |
| **Multiple Goals** | Priority 1 vs Priority 5 goals | Priority-first strategy completely satisfies Priority 1 before Priority 2+. |
| **Missing Target Date** | `targetDate == null` | Urgency score falls back to baseline default (0.55). |
| **Invalid Inputs** | NaN, null, undefined amounts | `normalizeRequested` and `clamp` safely default to 0. |

---

## Test File Organization & Naming

* Place test files directly alongside the service being tested or under `src/services/`:
  - `src/services/GoalAllocationService.test.ts`
  - `src/services/investmentEngine.test.ts`
  - `src/services/goalProgress.test.ts`
  - `src/services/balance.test.ts`
  - `src/services/analytics.test.ts`
  - `lib/utils.test.ts`

---

## Writing High-Quality Vitest Tests

Follow this standard structure for unit tests:

```typescript
import { describe, it, expect } from 'vitest';
import { clamp } from '@/src/services/shared/math';

describe('math service', () => {
  describe('clamp', () => {
    it('clamps values below minimum to lower bound', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps values above maximum to upper bound', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('returns original value when within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });
});
```

---

## Completion Criteria

Testing is complete ONLY when:
1. New or modified domain logic is covered by unit tests.
2. Boundary conditions (zero, negative, max limits, null values) are explicitly asserted.
3. `npm run test` passes with **100% passing tests**.
