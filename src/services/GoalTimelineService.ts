/**
 * GoalTimelineService: Timeline visualization, historical tracking, and delta analysis for goals.
 */

export type TimelineEvent = {
    goalId: string;
    goalTitle: string;
    type: "target-date" | "estimated-completion" | "milestone-reached" | "status-change";
    date: Date;
    daysFromNow: number;
    milestone?: string;
    description: string;
};

export type GoalTimelineData = {
    goalId: string;
    goalTitle: string;
    priority: number;
    targetDate: Date | null;
    estimatedCompletion: Date | null;
    currentAmount: number;
    targetAmount: number;
    progressPct: number;
    health: string | null;
    confidenceScore: number | null;
};

export type TimelineSegment = {
    goalId: string;
    goalTitle: string;
    priority: number;
    startDate: Date;
    endDate: Date | null;
    durationMonths: number | null;
    progressPct: number;
    health: string | null;
    color: string;
    urgency: "critical" | "high" | "medium" | "low";
};

export type GanttChartData = {
    numMonths: number;
    startDate: Date;
    endDate: Date;
    segments: TimelineSegment[];
    today: Date;
    events: TimelineEvent[];
};

export type TimelineDelta = {
    goalId: string;
    goalTitle: string;
    previousETA: Date | null;
    currentETA: Date | null;
    daysDelta: number;
    direction: "accelerating" | "delayed" | "on-track";
    reason: string;
};

export type TimelineInsight = {
    totalGoals: number;
    goalsAtRisk: number;
    goalsOnTrack: number;
    goalsAhead: number;
    nearestDeadline: TimelineEvent | null;
    averageCompletionMonths: number | null;
    deltas: TimelineDelta[];
};

function getColorForHealth(health: string | null): string {
    if (!health) return "#94a3b8"; // slate
    if (health === "Ahead of Schedule") return "#10b981"; // emerald
    if (health === "On Track") return "#3b82f6"; // blue
    if (health === "At Risk") return "#f59e0b"; // amber
    return "#ef4444"; // red
}

function getUrgencyForHealth(health: string | null): "critical" | "high" | "medium" | "low" {
    if (!health) return "low";
    if (health === "Off Track") return "critical";
    if (health === "At Risk") return "high";
    if (health === "On Track") return "medium";
    return "low";
}

function daysBetweenDates(from: Date, to: Date): number {
    return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function monthsBetweenDates(from: Date, to: Date): number {
    return Math.round((to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()));
}

export function buildTimelineEvents(goals: GoalTimelineData[]): TimelineEvent[] {
    const now = new Date();
    const events: TimelineEvent[] = [];

    for (const goal of goals) {
        if (goal.targetDate) {
            events.push({
                goalId: goal.goalId,
                goalTitle: goal.goalTitle,
                type: "target-date",
                date: goal.targetDate,
                daysFromNow: daysBetweenDates(now, goal.targetDate),
                description: `Target date for ${goal.goalTitle}`,
            });
        }

        if (goal.estimatedCompletion) {
            events.push({
                goalId: goal.goalId,
                goalTitle: goal.goalTitle,
                type: "estimated-completion",
                date: goal.estimatedCompletion,
                daysFromNow: daysBetweenDates(now, goal.estimatedCompletion),
                description: `Estimated completion of ${goal.goalTitle}`,
            });
        }
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildGanttData(goals: GoalTimelineData[]): GanttChartData {
    const now = new Date();
    const events = buildTimelineEvents(goals);

    const allDates = [
        now,
        ...goals.map((g) => g.targetDate).filter(Boolean),
        ...goals.map((g) => g.estimatedCompletion).filter(Boolean),
    ].filter(Boolean) as Date[];

    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : new Date();
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : new Date(now.getFullYear(), now.getMonth() + 12, now.getDate());

    const startDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const endDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
    const numMonths = monthsBetweenDates(startDate, endDate) + 1;

    const segments: TimelineSegment[] = goals.map((goal) => {
        const startDate = goal.targetDate || now;
        const endDate = goal.estimatedCompletion;
        const durationMonths = endDate ? monthsBetweenDates(startDate, endDate) : null;

        return {
            goalId: goal.goalId,
            goalTitle: goal.goalTitle,
            priority: goal.priority ?? 3,
            startDate,
            endDate,
            durationMonths,
            progressPct: goal.progressPct ?? 0,
            health: goal.health ?? null,
            color: getColorForHealth(goal.health),
            urgency: getUrgencyForHealth(goal.health),
        };
    });

    return {
        numMonths,
        startDate,
        endDate,
        segments: segments.sort((a, b) => a.priority - b.priority),
        today: now,
        events,
    };
}

export function computeTimelineDeltas(previousGoals: GoalTimelineData[], currentGoals: GoalTimelineData[]): TimelineDelta[] {
    const previousByGoal = new Map(previousGoals.map((g) => [g.goalId, g]));
    const now = new Date();

    return currentGoals.map((goal) => {
        const prev = previousByGoal.get(goal.goalId);
        const previousETA = prev?.estimatedCompletion ?? null;
        const currentETA = goal.estimatedCompletion ?? null;

        let daysDelta = 0;
        let direction: "accelerating" | "delayed" | "on-track" = "on-track";

        if (previousETA && currentETA) {
            daysDelta = daysBetweenDates(currentETA, previousETA);
            if (daysDelta > 7) {
                direction = "accelerating";
            } else if (daysDelta < -7) {
                direction = "delayed";
            }
        }

        let reason = "";
        if (direction === "accelerating") {
            reason = `Progress accelerated — ${Math.abs(daysDelta)} days faster than expected`;
        } else if (direction === "delayed") {
            reason = `Timeline pushed back — ${Math.abs(daysDelta)} days later than forecast`;
        } else if (currentETA) {
            const daysToCompletion = daysBetweenDates(now, currentETA);
            if (daysToCompletion <= 0) {
                reason = "Target completion date passed";
            } else if (daysToCompletion <= 30) {
                reason = `Completing within ${Math.ceil(daysToCompletion / 7)} weeks`;
            } else {
                reason = `On pace to complete in ${Math.ceil(daysToCompletion / 30)} months`;
            }
        } else {
            reason = "Completion date unknown — no target date or savings velocity";
        }

        return {
            goalId: goal.goalId,
            goalTitle: goal.goalTitle,
            previousETA,
            currentETA,
            daysDelta,
            direction,
            reason,
        };
    });
}

export function buildTimelineInsight(goals: GoalTimelineData[], deltas: TimelineDelta[]): TimelineInsight {
    const now = new Date();
    const events = buildTimelineEvents(goals);
    const nearestEvent = events.find((e) => e.daysFromNow >= 0) || null;

    const goalsAtRisk = goals.filter((g) => g.health === "At Risk" || g.health === "Off Track").length;
    const goalsOnTrack = goals.filter((g) => g.health === "On Track").length;
    const goalsAhead = goals.filter((g) => g.health === "Ahead of Schedule").length;

    const completionMonths = goals
        .filter((g) => g.estimatedCompletion)
        .map((g) => monthsBetweenDates(now, g.estimatedCompletion!))
        .filter((m) => m >= 0);

    const averageCompletionMonths = completionMonths.length > 0 ? Math.round(completionMonths.reduce((a, b) => a + b, 0) / completionMonths.length) : null;

    return {
        totalGoals: goals.length,
        goalsAtRisk,
        goalsOnTrack,
        goalsAhead,
        nearestDeadline: nearestEvent,
        averageCompletionMonths,
        deltas,
    };
}

export function formatTimelineInsight(insight: TimelineInsight): string[] {
    const lines: string[] = [];

    lines.push(`${insight.totalGoals} total goals`);
    if (insight.goalsAhead > 0) lines.push(`🟢 ${insight.goalsAhead} ahead of schedule`);
    if (insight.goalsOnTrack > 0) lines.push(`🔵 ${insight.goalsOnTrack} on track`);
    if (insight.goalsAtRisk > 0) lines.push(`🟡 ${insight.goalsAtRisk} at risk`);

    if (insight.nearestDeadline) {
        const daysLeft = insight.nearestDeadline.daysFromNow;
        if (daysLeft <= 0) {
            lines.push(`⏰ Overdue: ${insight.nearestDeadline.goalTitle}`);
        } else if (daysLeft <= 30) {
            lines.push(`⏰ Due soon: ${insight.nearestDeadline.goalTitle} in ${Math.ceil(daysLeft / 7)} weeks`);
        } else {
            lines.push(`📅 Next: ${insight.nearestDeadline.goalTitle} in ${Math.ceil(daysLeft / 30)} months`);
        }
    }

    if (insight.averageCompletionMonths) {
        lines.push(`📊 Average completion: ${insight.averageCompletionMonths} months`);
    }

    const accelerating = insight.deltas.filter((d) => d.direction === "accelerating");
    if (accelerating.length > 0) {
        lines.push(`📈 ${accelerating.length} goal(s) accelerating`);
    }

    const delayed = insight.deltas.filter((d) => d.direction === "delayed");
    if (delayed.length > 0) {
        lines.push(`📉 ${delayed.length} goal(s) delayed`);
    }

    return lines;
}

export function normalizeGoalForTimeline(goal: any): GoalTimelineData {
    return {
        goalId: goal.id,
        goalTitle: goal.title,
        priority: goal.priority ?? 3,
        targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
        estimatedCompletion: goal.eta?.eta ? new Date(goal.eta.eta) : null,
        currentAmount: goal.currentAmount ?? 0,
        targetAmount: goal.targetAmount ?? 0,
        progressPct: goal.progressPct ?? 0,
        health: goal.health ?? null,
        confidenceScore: goal.confidenceScore ?? null,
    };
}
