/**
 * Goals domain — barrel re-export.
 *
 * All goal-related services live in the parent `src/services/` directory.
 * This barrel makes them importable as a domain group:
 *   import { listGoals, getGoalOverview } from "@/src/services/goals"
 *
 * For AI agents: this is the domain for goal CRUD, progress tracking,
 * monthly allocation, feasibility scoring, timeline visualization,
 * and goal-based financial advice.
 */
export * from "../goals";
export * from "../goalProgress";
export * from "../GoalAllocationService";
export * from "../GoalFeasibilityService";
export * from "../GoalForecastService";
export * from "../GoalTimelineService";
export * from "../GoalAdvisorService";
export * from "../GoalInsightService";
