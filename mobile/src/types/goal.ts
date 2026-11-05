export type GoalMilestone = {
  label: string;
  thresholdPct: number;
  achieved: boolean;
  amount: number;
  amountLabel: string;
};

export type Goal = {
  id: string;
  title: string;
  status?: string | null;
  targetAmount: number;
  currentAmount: number;
  spentAmount?: number;
  spentAmountLabel?: string | null;
  resultantTargetAmount?: number;
  resultantTargetAmountLabel?: string | null;
  progressPct?: number;
  monthlyTarget?: number | null;
  priority: number;
  currency?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  targetAmountLabel?: string | null;
  currentAmountLabel?: string | null;
  monthsLeft?: number | null;
  recommendedMonthly?: number | null;
  recommendedMonthlyContribution?: number | null;
  recommendedMonthlyContributionLabel?: string | null;
  eta?: { months?: number | null; eta?: string | null } | string | null;
  milestones?: GoalMilestone[];
  nextMilestone?: GoalMilestone | null;
  requiredMonthly?: number | null;
  requiredMonthlyLabel?: string | null;
  health?: string | null;
  confidenceScore?: number | null;
  recommendations?: string[] | null;
};

export type EmergencyFundData = {
  targetMonths: number;
  avgMonthlyExpenses: number;
  targetAmount: number;
  savedAmount: number;
  progressPct: number;
  shortfall: number;
  monthsToComplete: number | null;
  estimatedCompletionDate: string | null;
  isComplete: boolean;
  monthlyCapacity: number;
  efStrategy?: string;
  efRatio?: number;
  goalsRatio?: number;
  tier?: number;
  efMonthlyDrip?: number;
  availableGoalCapacity?: number;
};
