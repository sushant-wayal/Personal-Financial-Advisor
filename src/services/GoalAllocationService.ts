export type GoalAllocationStrategy = "priority-first" | "proportional" | "utility";

export type GoalAllocationInput = {
    id: string;
    title?: string;
    priority?: number;
    recommendedMonthlyContribution: number;
    requiredMonthly?: number;
    monthsLeft?: number | null;
    targetAmount?: number;
    currentAmount?: number;
    progressPct?: number | null;
    confidenceScore?: number | null;
    health?: string | null;
};

export type GoalAllocationLine = {
    goalId: string;
    goalTitle?: string;
    requested: number;
    allocated: number;
    shortfall: number;
    sharePct: number;
    utilityScore: number;
    urgencyScore: number;
    priorityScore: number;
    reason: string;
};

export type Allocation = {
    strategy: GoalAllocationStrategy;
    allocations: GoalAllocationLine[];
    remainingCapacity: number;
    deployedCapacity: number;
    totalRequested: number;
    utilizationPct: number;
    summary: string;
    tradeoffs: string[];
};

export type AllocationScenarioImpact = {
    goalId: string;
    goalTitle: string;
    oldAllocated: number;
    newAllocated: number;
    allocatedDelta: number;
    oldSharePct: number;
    newSharePct: number;
    summary: string;
    reason: string;
};

export type AllocationScenario = {
    strategy: GoalAllocationStrategy;
    description: string;
    baseCapacity: number;
    newMonthlyCapacity: number;
    basePlan: Allocation;
    scenarioPlan: Allocation;
    impacts: AllocationScenarioImpact[];
    tradeoffs: string[];
};

type AllocationWorkingGoal = GoalAllocationInput & {
    requested: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function safeCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function normalizeRequested(value: number) {
    return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function normalizePriority(priority?: number) {
    return clamp(priority ?? 3, 1, 5);
}

function getPriorityScore(goal: GoalAllocationInput) {
    return clamp(1 / normalizePriority(goal.priority), 0.2, 1);
}

function getUrgencyScore(goal: GoalAllocationInput) {
    if (goal.monthsLeft == null) return 0.55;
    if (goal.monthsLeft <= 0) return 1;
    return clamp(1 - goal.monthsLeft / 18, 0.1, 1);
}

function getNeedScore(goal: GoalAllocationInput) {
    if (!goal.targetAmount || goal.targetAmount <= 0) return 0.5;
    const progress = clamp((goal.currentAmount ?? 0) / goal.targetAmount, 0, 1);
    return clamp(1 - progress, 0, 1);
}

function getConfidenceScore(goal: GoalAllocationInput) {
    if (goal.confidenceScore == null) return 0.65;
    return clamp(goal.confidenceScore / 100, 0.2, 1);
}

function getUtilityScore(goal: GoalAllocationInput) {
    const priorityScore = getPriorityScore(goal);
    const urgencyScore = getUrgencyScore(goal);
    const needScore = getNeedScore(goal);
    const confidenceScore = getConfidenceScore(goal);
    return clamp(priorityScore * 0.3 + urgencyScore * 0.3 + needScore * 0.25 + confidenceScore * 0.15, 0.05, 1);
}

function buildReason(goal: GoalAllocationInput, strategy: GoalAllocationStrategy, allocated: number, requested: number, utilityScore: number, urgencyScore: number) {
    if (allocated <= 0) {
        return strategy === "priority-first"
            ? "Deferred because higher-priority goals consumed the available capacity"
            : "Deferred because the plan prioritized stronger near-term goals";
    }

    if (allocated >= requested) {
        return strategy === "proportional"
            ? "Fully funded in proportion to monthly need"
            : "Fully funded under the current allocation strategy";
    }

    if (strategy === "priority-first") {
        return "Partially funded after higher-priority goals were satisfied";
    }

    if (strategy === "proportional") {
        return "Received a proportional share based on requested monthly need";
    }

    const urgencyLabel = urgencyScore >= 0.8 ? "high urgency" : urgencyScore >= 0.5 ? "moderate urgency" : "lower urgency";
    const utilityLabel = utilityScore >= 0.75 ? "very strong utility" : utilityScore >= 0.45 ? "balanced utility" : "lower utility";
    return `Allocated due to ${urgencyLabel} and ${utilityLabel}`;
}

function sortForPriorityFirst(goals: AllocationWorkingGoal[]) {
    return goals.slice().sort((a, b) => {
        const priorityDelta = normalizePriority(a.priority) - normalizePriority(b.priority);
        if (priorityDelta !== 0) return priorityDelta;

        const urgencyDelta = getUrgencyScore(b) - getUrgencyScore(a);
        if (Math.abs(urgencyDelta) > 1e-6) return urgencyDelta;

        const utilityDelta = getUtilityScore(b) - getUtilityScore(a);
        if (Math.abs(utilityDelta) > 1e-6) return utilityDelta;

        return (b.requested || 0) - (a.requested || 0);
    });
}

function buildPlan(
    goals: AllocationWorkingGoal[],
    monthlyCapacity: number,
    strategy: GoalAllocationStrategy,
    allocator: (items: AllocationWorkingGoal[], capacity: number) => number[],
): Allocation {
    const sanitizedCapacity = Math.max(0, monthlyCapacity);
    const allocations = allocator(goals, sanitizedCapacity);
    const totalRequested = goals.reduce((sum, goal) => sum + goal.requested, 0);
    const deployedCapacity = Math.min(sanitizedCapacity, allocations.reduce((sum, value) => sum + value, 0));
    const remainingCapacity = Math.max(0, Math.round(sanitizedCapacity - deployedCapacity));
    const utilizationPct = sanitizedCapacity > 0 ? Math.round((deployedCapacity / sanitizedCapacity) * 100) : 0;

    const lines = goals.map((goal, index) => {
        const allocated = Math.max(0, Math.round(allocations[index] || 0));
        const requested = goal.requested;
        const shortfall = Math.max(0, requested - allocated);
        const sharePct = totalRequested > 0 ? Math.round((allocated / totalRequested) * 100) : 0;
        const utilityScore = getUtilityScore(goal);
        const urgencyScore = getUrgencyScore(goal);
        const priorityScore = getPriorityScore(goal);
        return {
            goalId: goal.id,
            goalTitle: goal.title,
            requested,
            allocated,
            shortfall,
            sharePct,
            utilityScore: Math.round(utilityScore * 100),
            urgencyScore: Math.round(urgencyScore * 100),
            priorityScore: Math.round(priorityScore * 100),
            reason: buildReason(goal, strategy, allocated, requested, utilityScore, urgencyScore),
        };
    });

    const underfunded = lines.filter((line) => line.shortfall > 0);
    const fullyFunded = lines.filter((line) => line.shortfall === 0);
    const tradeoffs: string[] = [];

    if (sanitizedCapacity <= 0) {
        tradeoffs.push("No monthly capacity is available, so all goals are deferred.");
    } else if (underfunded.length === 0) {
        tradeoffs.push("Every goal can be fully funded at the current monthly capacity.");
    } else {
        const topUnderfunded = underfunded.slice().sort((a, b) => b.shortfall - a.shortfall).slice(0, 3);
        tradeoffs.push(`${underfunded.length} goals remain partially funded under this strategy.`);
        topUnderfunded.forEach((goal) => {
            tradeoffs.push(`${goal.goalTitle || goal.goalId} still needs ${safeCurrency(goal.shortfall)} per month.`);
        });
        if (fullyFunded.length > 0) {
            tradeoffs.push(`${fullyFunded.length} goals are fully protected by this allocation.`);
        }
    }

    const summary = strategy === "priority-first"
        ? "Priority-first allocation funds the most urgent goals first until the budget is exhausted."
        : strategy === "proportional"
            ? "Proportional allocation spreads the budget across goals based on monthly need."
            : "Utility-based allocation favors goals with the strongest blend of urgency, need, priority, and confidence."

    return {
        strategy,
        allocations: lines,
        remainingCapacity,
        deployedCapacity: Math.round(deployedCapacity),
        totalRequested: Math.round(totalRequested),
        utilizationPct,
        summary,
        tradeoffs,
    };
}

function allocatePriorityFirst(goals: AllocationWorkingGoal[], monthlyCapacity: number) {
    const sorted = sortForPriorityFirst(goals);
    const result = new Map<string, number>();
    let remaining = monthlyCapacity;

    for (const goal of sorted) {
        const give = Math.min(goal.requested, remaining);
        result.set(goal.id, give);
        remaining -= give;
    }

    return goals.map((goal) => result.get(goal.id) || 0);
}

function allocateWeighted(goals: AllocationWorkingGoal[], monthlyCapacity: number, weightFn: (goal: AllocationWorkingGoal) => number) {
    const allocations = goals.map(() => 0);
    const needs = goals.map((goal) => goal.requested);
    let active = goals.map((_, index) => index).filter((index) => needs[index] > 0);
    let remainingCapacity = Math.max(0, monthlyCapacity);
    let guard = 0;

    while (active.length > 0 && remainingCapacity > 0.0001 && guard < goals.length * 8) {
        guard += 1;
        const roundCapacity = remainingCapacity;
        const totalWeight = active.reduce((sum, index) => sum + Math.max(weightFn(goals[index]), 0.0001), 0);
        const nextActive: number[] = [];
        let allocatedThisRound = 0;

        for (const index of active) {
            const goal = goals[index];
            const weight = Math.max(weightFn(goal), 0.0001);
            const need = needs[index];
            if (need <= 0) continue;

            const idealShare = totalWeight > 0 ? roundCapacity * (weight / totalWeight) : roundCapacity / active.length;
            const give = Math.min(need, idealShare);
            allocations[index] += give;
            needs[index] = Math.max(0, need - give);
            allocatedThisRound += give;

            if (needs[index] > 0.0001) {
                nextActive.push(index);
            }
        }

        remainingCapacity = Math.max(0, roundCapacity - allocatedThisRound);
        if (nextActive.length === active.length && allocatedThisRound <= 0.0001) {
            break;
        }
        active = nextActive;
    }

    if (remainingCapacity > 0.0001) {
        const extraRoom = goals
            .map((goal, index) => ({
                index,
                weight: Math.max(weightFn(goal), 0.0001),
                room: Math.max(0, needs[index]),
            }))
            .filter((entry) => entry.room > 0)
            .sort((a, b) => b.weight - a.weight || b.room - a.room);

        let leftover = remainingCapacity;
        for (const entry of extraRoom) {
            if (leftover <= 0.0001) break;
            const give = Math.min(entry.room, leftover);
            allocations[entry.index] += give;
            leftover -= give;
        }

        remainingCapacity = leftover;
    }

    const integerAllocations = allocations.map((value) => Math.max(0, Math.floor(value)));
    const fractionalParts = allocations.map((value, index) => ({
        index,
        fraction: value - Math.floor(value),
        room: Math.max(0, goals[index].requested - integerAllocations[index]),
        weight: Math.max(weightFn(goals[index]), 0.0001),
    }));

    const targetTotal = Math.max(0, Math.round(monthlyCapacity));
    const allocatedTotal = integerAllocations.reduce((sum, value) => sum + value, 0);
    let diff = targetTotal - allocatedTotal;

    if (diff > 0) {
        const ranked = fractionalParts
            .filter((entry) => entry.room > 0)
            .sort((a, b) => b.fraction - a.fraction || b.weight - a.weight || b.room - a.room);

        for (const entry of ranked) {
            if (diff <= 0) break;
            const give = Math.min(diff, entry.room);
            integerAllocations[entry.index] += give;
            diff -= give;
        }
    }

    return integerAllocations;
}

export function allocateMonthlyCapacity(
    goals: GoalAllocationInput[],
    monthlyCapacity: number,
    options: { strategy?: GoalAllocationStrategy } = {},
): Allocation {
    const strategy = options.strategy || "utility";
    const workingGoals: AllocationWorkingGoal[] = goals.map((goal) => ({
        ...goal,
        requested: normalizeRequested(goal.recommendedMonthlyContribution),
    }));

    if (strategy === "priority-first") {
        return buildPlan(workingGoals, monthlyCapacity, strategy, allocatePriorityFirst);
    }

    if (strategy === "proportional") {
        return buildPlan(workingGoals, monthlyCapacity, strategy, (items, capacity) => allocateWeighted(items, capacity, (goal) => Math.max(goal.requested, 1)));
    }

    return buildPlan(workingGoals, monthlyCapacity, strategy, (items, capacity) => allocateWeighted(items, capacity, (goal) => {
        const utilityScore = getUtilityScore(goal);
        const requestedWeight = Math.max(goal.requested, 1);
        return requestedWeight * (0.35 + utilityScore);
    }));
}

export function simulateCapacityShift(
    goals: GoalAllocationInput[],
    baseCapacity: number,
    capacityDelta: number,
    strategy: GoalAllocationStrategy = "utility",
): AllocationScenario {
    const newMonthlyCapacity = Math.max(0, baseCapacity + capacityDelta);
    const basePlan = allocateMonthlyCapacity(goals, baseCapacity, { strategy });
    const scenarioPlan = allocateMonthlyCapacity(goals, newMonthlyCapacity, { strategy });
    const baseByGoal = new Map(basePlan.allocations.map((line) => [line.goalId, line]));
    const scenarioByGoal = new Map(scenarioPlan.allocations.map((line) => [line.goalId, line]));

    const impacts = goals.map((goal) => {
        const before = baseByGoal.get(goal.id) || {
            goalId: goal.id,
            goalTitle: goal.title,
            requested: 0,
            allocated: 0,
            shortfall: 0,
            sharePct: 0,
            utilityScore: 0,
            urgencyScore: 0,
            priorityScore: 0,
            reason: "No allocation",
        };
        const after = scenarioByGoal.get(goal.id) || before;
        const allocatedDelta = after.allocated - before.allocated;
        const shareDelta = after.sharePct - before.sharePct;
        const summary = allocatedDelta > 0
            ? `Gains ${safeCurrency(allocatedDelta)} per month`
            : allocatedDelta < 0
                ? `Loses ${safeCurrency(Math.abs(allocatedDelta))} per month`
                : "No allocation change";

        return {
            goalId: goal.id,
            goalTitle: goal.title || goal.id,
            oldAllocated: before.allocated,
            newAllocated: after.allocated,
            allocatedDelta,
            oldSharePct: before.sharePct,
            newSharePct: after.sharePct,
            summary: `${summary}${shareDelta !== 0 ? ` (${shareDelta > 0 ? "+" : ""}${shareDelta}% share)` : ""}`,
            reason: after.reason,
        };
    }).sort((a, b) => Math.abs(b.allocatedDelta) - Math.abs(a.allocatedDelta));

    const tradeoffs: string[] = [];
    const winners = impacts.filter((impact) => impact.allocatedDelta > 0).slice(0, 2);
    const losers = impacts.filter((impact) => impact.allocatedDelta < 0).slice(0, 2);

    if (capacityDelta === 0) {
        tradeoffs.push("This scenario keeps monthly capacity unchanged, so the plan becomes a comparison baseline.");
    } else if (capacityDelta > 0) {
        tradeoffs.push(`Additional capacity of ${safeCurrency(capacityDelta)} is available to reallocate.`);
    } else {
        tradeoffs.push(`Capacity drops by ${safeCurrency(Math.abs(capacityDelta))}, forcing tradeoffs across goals.`);
    }

    winners.forEach((impact) => tradeoffs.push(`${impact.goalTitle} gains ${safeCurrency(impact.allocatedDelta)} per month.`));
    losers.forEach((impact) => tradeoffs.push(`${impact.goalTitle} loses ${safeCurrency(Math.abs(impact.allocatedDelta))} per month.`));

    const description = capacityDelta > 0
        ? `If monthly savings increase by ${safeCurrency(capacityDelta)}`
        : capacityDelta < 0
            ? `If monthly savings decrease by ${safeCurrency(Math.abs(capacityDelta))}`
            : "If monthly savings stay the same";

    return {
        strategy,
        description,
        baseCapacity,
        newMonthlyCapacity,
        basePlan,
        scenarioPlan,
        impacts,
        tradeoffs,
    };
}
