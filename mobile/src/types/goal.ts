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
  targetAmount: number;
  currentAmount: number;
  monthlyTarget?: number | null;
  priority: number;
  currency?: string | null;
  targetDate?: string | null;
  notes?: string | null;
  monthsLeft?: number | null;
  recommendedMonthly?: number | null;
  recommendedMonthlyContribution?: number | null;
  recommendedMonthlyContributionLabel?: string | null;
  eta?: { months: number; eta: string } | null;
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
};
