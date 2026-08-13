# Funding Engine Skill

## Purpose

Provide detailed technical guidance on the **funding, surplus allocation, emergency fund drip, and spillover mechanics** in the **Personal Financial Advisor** system.

---

## The Core Funding Allocation Cascade

The repository processes monthly investable capacity through a strict 4-stage cascade:

```text
1. Compute Net Monthly Capacity
   (Monthly Income - Monthly Expenses)
        ↓
2. Apply Phase Investable Rate
   (Carves out % for Wealth Investments based on Phase: CRISIS 0%, EF_BUILDING 15%, WEALTH_BUILDING 100%, GOAL_SPRINT 40%)
        ↓
3. Drip to Emergency Fund (EF)
   (Applies EF strategy ratio based on Safety Tier 1 / 2 / 3 until EF target is satisfied)
        ↓
4. Fund Active Goals Pool
   (Allocates remaining goal capacity across active goals via Priority-First, Proportional, or Utility Strategy)
        ↓
5. Spillover Routing
   (Leftover goal capacity beyond unfunded goal needs spills to Emergency Fund; once EF is full, spills to Investments)
```

---

## Strategy Allocation Mechanics (`GoalAllocationService.ts`)

When monthly capacity reaches the active goals pool, `GoalAllocationService.ts` distributes funds using one of three strategies:

### 1. `priority-first` (Default)
- Sorts goals by priority (1 = highest, 5 = lowest), then by urgency, utility score, and requested amount.
- Funds the top goal completely before moving any capital to the next goal.
- If capacity runs out mid-list, lower-priority goals receive 0 allocation.

### 2. `proportional`
- Distributes available capacity across all goals proportionally based on each goal's requested monthly contribution (`sharePct = requested / totalRequested`).
- Ensures every active goal receives a portion of monthly capacity.

### 3. `utility`
- Computes a weighted utility score for each goal:
  $$\text{Utility} = 0.30 \times \text{Priority} + 0.30 \times \text{Urgency} + 0.25 \times \text{Need} + 0.15 \times \text{Confidence}$$
- Allocates funds using weighted distribution favoring high-utility goals while preventing starvation.

---

## Spillover & Balance Allocation Rules (`emergencyFund.ts`)

1. **Liquid Cash Partitioning**:
   - Total liquid bank balance (`profile.balance`) is partitioned between Emergency Fund (`savedAmount`) and Goals Pool (`availableBalance`).
2. **Surplus Spillover to EF**:
   - `totalGoalsNeeded` = sum of unfunded goal amounts ($\max(0, \text{targetAmount} - \text{currentAmount})$).
   - If the goals pool balance exceeds `totalGoalsNeeded`, the entire surplus spills back into `savedAmount` of Emergency Fund.
3. **No-Goal & Fully-Funded Goal Handling**:
   - If zero active goals exist OR all goals are fully funded ($\text{totalGoalsNeeded} = 0$), 100% of non-investment monthly capacity drips directly into EF until full.
   - Once EF is 100% funded ($\text{isComplete} = \text{true}$), 100% of monthly capacity flows to active goals and investment spillover.

---

## Mandatory Edge-Case Verification Matrix

When modifying funding engine code, test against this explicit edge-case matrix:

| Test Case | Scenario Condition | Expected Behavior |
| :--- | :--- | :--- |
| **Case 1: No Surplus** | Income <= Expenses | Investable capacity = 0; EF drip = 0; Goal allocation = 0; Phase = CRISIS. |
| **Case 2: Negative Balance** | `balance < 0` | Balance clamped to 0; EF saved = 0; available balance = 0. |
| **Case 3: Single Goal Partial** | 1 active goal, capacity < needed | Goal receives 100% of goal capacity; shortfall recorded; zero spillover. |
| **Case 4: Multi-Goal Priority** | Priority 1 ($10k) & Priority 3 ($10k), capacity = $12k | Priority 1 gets $10k (100%); Priority 3 gets $2k (20%). |
| **Case 5: Goal Fully Funded** | `currentAmount >= targetAmount` | Goal requirement = 0; allocation = 0; capacity passes to next goal or EF spillover. |
| **Case 6: All Goals Funded** | Every goal `currentAmount >= targetAmount` | `totalGoalsNeeded = 0`; 100% goal pool balance spills to EF; 100% drip to EF. |
| **Case 7: EF Tier 1 Starter** | EF progress < 25% or saved < 1 mo expense | Safety tier 1 triggers; aggressive EF ratio (85-95%) enforced. |
| **Case 8: EF Fully Funded** | `savedAmount >= targetAmount` | `isComplete = true`; EF drip = 0; 100% capacity passes to Goals/Wealth building. |
| **Case 9: Goals + EF Complete** | All goals funded & EF complete | 100% of surplus flows to Investment engine (Wealth Building phase). |
| **Case 10: Capacity Rounding** | Non-integer division | Allocations integer-floored; remainders distributed by highest fraction to prevent off-by-one sum error. |

---

## Prohibited Engine Actions

Agents MUST NEVER:
* Override priority-first allocation logic to arbitrarily allocate funds to lower-priority goals.
* Silently modify phase investable percentages (`CRISIS`: 0%, `EF_BUILDING`: 15%, `WEALTH_BUILDING`: 100%, `GOAL_SPRINT`: 40%).
* Allow total allocated monthly capacity to exceed total available monthly capacity.
* Introduce floating-point sum mismatches where $\sum \text{allocated} \neq \text{deployedCapacity}$.

---

## Completion Criteria

Engine changes are complete ONLY when:
1. All 10 edge cases pass in Vitest unit tests.
2. `GoalAllocationService.test.ts` and `investmentEngine.test.ts` pass cleanly.
3. `npx tsc --noEmit` and `npm run lint` report **0 errors and 0 warnings**.
