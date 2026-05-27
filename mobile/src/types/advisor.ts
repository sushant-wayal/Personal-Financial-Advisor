export type AdvisorTone = "critical" | "warning" | "neutral" | "success" | "positive" | "negative" | "info";

export type AdvisorPriority = "critical" | "high" | "medium" | "low";

export type AdvisorMetric = {
    label: string;
    value: string;
    tone?: AdvisorTone;
    note?: string;
};

export type AdvisorHealthCard = {
    type: "healthCard";
    title: string;
    status: "critical" | "warning" | "neutral" | "healthy" | "success";
    summary?: string;
    metrics?: AdvisorMetric[];
    note?: string;
};

export type AdvisorDualMetric = {
    type: "dualMetric";
    left: AdvisorMetric;
    right: AdvisorMetric;
};

export type AdvisorMetricsGrid = {
    type: "metricsGrid";
    title?: string;
    metrics: AdvisorMetric[];
};

export type AdvisorRiskItem = {
    title: string;
    description: string;
    severity?: AdvisorTone;
};

export type AdvisorRiskList = {
    type: "riskList";
    title: string;
    items: AdvisorRiskItem[];
};

export type AdvisorWarning = {
    type: "warning";
    title: string;
    content: string;
    severity?: AdvisorTone;
};

export type AdvisorDirective = {
    type: "directive";
    title: string;
    content: string;
    priority?: AdvisorPriority;
};

export type AdvisorRecommendation = {
    type: "recommendation";
    title: string;
    content: string;
    reasoning?: string;
    nextStep?: string;
    tone?: AdvisorTone;
};

export type AdvisorGoalCard = {
    type: "goalCard";
    title: string;
    status?: "critical" | "warning" | "neutral" | "healthy" | "success";
    progressPct?: number;
    progressLabel?: string;
    currentLabel?: string;
    targetLabel?: string;
    note?: string;
};

export type AdvisorGoalTimelineItem = {
    label: string;
    date?: string;
    status?: AdvisorTone;
    note?: string;
};

export type AdvisorGoalTimeline = {
    type: "goalTimeline";
    title: string;
    items: AdvisorGoalTimelineItem[];
};

export type AdvisorComparisonRow = {
    label: string;
    values: string[];
};

export type AdvisorComparisonTable = {
    type: "comparisonTable";
    title: string;
    columns: string[];
    rows: AdvisorComparisonRow[];
};

export type AdvisorPriorityCard = {
    type: "priorityCard";
    title: string;
    priority: AdvisorPriority;
    summary: string;
    reasons?: string[];
};

export type AdvisorDecisionSummary = {
    type: "decisionSummary";
    title: string;
    decision: string;
    recommendation: string;
    tradeoffs?: string[];
    nextStep?: string;
};

export type AdvisorArtifact =
    | AdvisorHealthCard
    | AdvisorDualMetric
    | AdvisorMetricsGrid
    | AdvisorRiskList
    | AdvisorWarning
    | AdvisorDirective
    | AdvisorRecommendation
    | AdvisorGoalCard
    | AdvisorGoalTimeline
    | AdvisorComparisonTable
    | AdvisorPriorityCard
    | AdvisorDecisionSummary;

export type AdvisorResponse = {
    narrative: string;
    artifacts: AdvisorArtifact[];
};