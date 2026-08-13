# Financial Calculations Skill

## Purpose

Establish strict rules, canonical helpers, and precision guidelines for numerical correctness in all financial calculations within the **Personal Financial Advisor** system.

---

## Canonical Math & Formatting Helpers

All numerical operations MUST use the shared canonical utilities located in `src/services/shared/`:

| Helper Function | Path | Purpose |
| :--- | :--- | :--- |
| `clamp(val, min, max)` | `src/services/shared/math.ts` | Restricts a numeric value strictly within min/max bounds. |
| `safeDivide(num, den, fallback)` | `src/services/shared/math.ts` | Performs division with zero/NaN protection, returning fallback. |
| `roundTo(val, decimals)` | `src/services/shared/math.ts` | Rounds number to explicit decimal places cleanly. |
| `formatCurrency(amount, currency)` | `src/services/shared/formatting.ts` | Formats INR currency using `Intl.NumberFormat('en-IN')`. |
| `formatPercent(value, decimals)` | `src/services/shared/formatting.ts` | Formats percentages cleanly. |
| `daysBetween(dateA, dateB)` | `src/services/shared/dates.ts` | Calculates absolute integer calendar days between two dates. |
| `monthsUntil(targetDate)` | `src/services/shared/dates.ts` | Calculates remaining months between today and a target date. |

---

## Monetary Precision & Floating-Point Protection Rules

1. **Avoid Floating-Point Drift**: Never perform chained floating-point arithmetic on currency values without explicit rounding (e.g. `0.1 + 0.2 === 0.30000000000000004`).
2. **Integer Cent/Rupee Rounding**: Round intermediate monetary allocations using `Math.round()` or `roundTo(val, 2)` before persisting or returning via API.
3. **No Repeated Rounding**: Keep unrounded numbers during intermediate multi-step calculations; apply final rounding strictly at the output boundary.
4. **Division Guard**: Always wrap division operations in `safeDivide(numerator, denominator, 0)` or check `if (denominator <= 0)` to prevent `Infinity` or `NaN`.
5. **Non-Negative Guards**: Monetary values for balances, transaction amounts, EF targets, and goal allocations must never be negative unless explicitly representing a net deficit metric. Use `Math.max(0, val)`.

---

## Verification Protocol for Formula Modifications

When adding or modifying any financial formula:

```text
Step 1: Document Formula & Units
        ↓
Step 2: Identify All Inputs & Source of Truth
        ↓
Step 3: Name Intermediate Variables Explicitly
        ↓
Step 4: Verify Boundary Inputs (0, negative, NaN, max limits)
        ↓
Step 5: Write Vitest Test Cases Covering Edge Values
        ↓
Step 6: Confirm Downstream UI & API Formatting Matches Expectations
```

### Example Verification Checklist

```typescript
// Good: Clear intermediate variables, non-negative guards, and safe division
const rawSurplus = grossIncome - totalExpenses;
const liquidBalance = Math.max(0, profile.balance);
const cappedSurplus = Math.min(rawSurplus, liquidBalance);
const smoothedSurplus = Math.max(0, Math.round(0.7 * cappedSurplus + 0.3 * previousSurplus));
const investableAmount = Math.round(smoothedSurplus * (investableRate / 100));
```

```typescript
// Bad: Inline complex expression with potential NaN and unrounded float drift
const investableAmount = (grossIncome - totalExpenses) * investableRate / 100 + previousSurplus * 0.3;
```

---

## Rounding & Remainder Allocation Protocol

When dividing a total budget (e.g., monthly capacity of $1,000) among multiple targets (e.g., 3 goals needing $333.33 each):

1. Compute integer floor allocations: `alloc = Math.floor(idealShare)`.
2. Compute remaining capacity: `leftover = totalCapacity - sum(allocations)`.
3. Sort items by fractional remainder or priority.
4. Distribute 1 currency unit to highest remainder items until `leftover === 0`.
5. Verify `sum(allocations) === totalCapacity`.

---

## Completion Criteria

Financial calculation work is complete ONLY when:
1. All math operations use canonical helpers from `src/services/shared/`.
2. Zero `NaN`, `Infinity`, or negative currency values can be produced.
3. Vitest test coverage verifies boundary inputs (0, negative, max limits).
4. `npm run test`, `npx tsc --noEmit`, and `npm run lint` report **0 errors and 0 warnings**.
