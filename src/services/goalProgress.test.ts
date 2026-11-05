import { describe, it, expect, vi } from 'vitest';
import { deriveGoalProgress, GoalProgressSeed, GoalProgressSignals } from './goalProgress';
import { getEfStrategyRatios } from './emergencyFund';

// Mock dependencies
vi.mock('./GoalFeasibilityService', () => ({
  computeHealthStatus: vi.fn().mockReturnValue('ON_TRACK'),
  computeConfidenceScore: vi.fn().mockReturnValue(0.9),
}));

vi.mock('./GoalForecastService', () => ({
  estimateForecast: vi.fn().mockReturnValue({
    requiredMonthly: 500,
    estimatedCompletion: { months: 12, eta: new Date('2025-01-01') },
  }),
}));

vi.mock('./GoalAllocationService', () => ({
  allocateMonthlyCapacity: vi.fn().mockReturnValue({
    allocations: [{ allocated: 500 }],
  }),
}));

describe('goalProgress service', () => {
  describe('getEfStrategyRatios strategy matrix', () => {
    it('returns correct splits for BALANCED strategy across tiers', () => {
      // Tier 1 (< 25% or < 1mo expense)
      const tier1 = getEfStrategyRatios('BALANCED', 10, 50000, 20000, false);
      expect(tier1).toEqual({ efRatio: 0.85, goalsRatio: 0.15, tier: 1 });

      // Tier 2 (25% - 99%)
      const tier2 = getEfStrategyRatios('BALANCED', 50, 50000, 150000, false);
      expect(tier2).toEqual({ efRatio: 0.70, goalsRatio: 0.30, tier: 2 });

      // Tier 3 (100% complete)
      const tier3 = getEfStrategyRatios('BALANCED', 100, 50000, 300000, true);
      expect(tier3).toEqual({ efRatio: 0, goalsRatio: 1.0, tier: 3 });
    });

    it('returns correct splits for AGGRESSIVE_EF strategy', () => {
      const tier1 = getEfStrategyRatios('AGGRESSIVE_EF', 10, 50000, 20000, false);
      expect(tier1).toEqual({ efRatio: 0.95, goalsRatio: 0.05, tier: 1 });

      const tier2 = getEfStrategyRatios('AGGRESSIVE_EF', 50, 50000, 150000, false);
      expect(tier2).toEqual({ efRatio: 0.85, goalsRatio: 0.15, tier: 2 });
    });

    it('returns correct splits for ACCELERATED_GOALS strategy', () => {
      const tier1 = getEfStrategyRatios('ACCELERATED_GOALS', 10, 50000, 20000, false);
      expect(tier1).toEqual({ efRatio: 0.70, goalsRatio: 0.30, tier: 1 });

      const tier2 = getEfStrategyRatios('ACCELERATED_GOALS', 50, 50000, 150000, false);
      expect(tier2).toEqual({ efRatio: 0.50, goalsRatio: 0.50, tier: 2 });
    });

    it('returns correct splits for STRICT strategy', () => {
      const tier1 = getEfStrategyRatios('STRICT', 10, 50000, 20000, false);
      expect(tier1).toEqual({ efRatio: 1.0, goalsRatio: 0.0, tier: 1 });

      const tier2 = getEfStrategyRatios('STRICT', 50, 50000, 150000, false);
      expect(tier2).toEqual({ efRatio: 1.0, goalsRatio: 0.0, tier: 2 });
    });
  });

  describe('deriveGoalProgress', () => {
    it('calculates goal progress correctly with Dual-Track signals', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: '1',
          title: 'Buy a car',
          targetAmount: 20000,
          currentAmount: 5000,
          priority: 1,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'USD',
        availableBalance: 10000,
        currentBalance: 15000,
        monthlyCapacity: 2000,
        availableGoalCapacity: 600, // 30% of 2000 under BALANCED Tier 2
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: false,
        efTarget: 15000,
        efMonthlyDrip: 1400,
        efRatio: 0.7,
        goalsRatio: 0.3,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress(goals, signals);

      expect(result).toHaveLength(1);
      const goal = result[0];

      expect(goal.id).toBe('1');
      expect(goal.currentAmount).toBe(5000);
      expect(goal.derivedCurrentAmount).toBe(5000);
      expect(goal.health).toBe('ON_TRACK');
      expect(goal.confidenceScore).toBe(0.9);
      expect(goal.requiredMonthly).toBe(500);
    });

    it('enforces balance safeguard so total allocated EF + goals never exceeds current balance', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: '2',
          title: 'Goal exceeding available balance',
          targetAmount: 30000,
          currentAmount: 8000,
          priority: 2,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'USD',
        availableBalance: 5000, // Only 5000 available after EF reservation
        currentBalance: 15000,
        monthlyCapacity: 2000,
        availableGoalCapacity: 600,
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: false,
        efTarget: 10000,
        efMonthlyDrip: 1400,
        efRatio: 0.7,
        goalsRatio: 0.3,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress(goals, signals);
      expect(result).toHaveLength(1);
      // Seed amount must be scaled/capped to 5000 so EF saved (10000) + Goal (5000) <= 15000 balance
      expect(result[0].currentAmount).toBe(5000);
      expect(result[0].derivedCurrentAmount).toBe(5000);
    });

    it('distributes remaining available balance to unseeded goals when some goals are seeded', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: 'seeded-1',
          title: 'Seeded Goal',
          targetAmount: 50000,
          currentAmount: 10000, // Explicitly seeded 10k
          priority: 2,
        },
        {
          id: 'unseeded-2',
          title: 'Unseeded House Down Payment',
          targetAmount: 200000,
          currentAmount: 0, // Unseeded
          priority: 3,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'INR',
        availableBalance: 60000, // 60k available
        currentBalance: 80000,
        monthlyCapacity: 5000,
        availableGoalCapacity: 2000,
        monthlySavings: 5000,
        currentMonthSavingsRate: 25,
        savingsRateChange: 0,
        efIsComplete: true,
        efTarget: 20000,
        efMonthlyDrip: 0,
        efRatio: 0,
        goalsRatio: 1.0,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress(goals, signals);
      expect(result).toHaveLength(2);

      const seeded = result.find((g) => g.id === 'seeded-1');
      const unseeded = result.find((g) => g.id === 'unseeded-2');

      // Seeded gets 10,000
      expect(seeded?.currentAmount).toBe(10000);
      // Unseeded gets remaining 50,000 (60,000 - 10,000), not 0!
      expect(unseeded?.currentAmount).toBe(50000);
    });

    it('calculates resultant target amount (target - spent) and computes health and progress against it', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: 'goa-trip',
          title: 'Goa Trip',
          targetAmount: 50000,
          spentAmount: 30000, // 30k already spent on flights/hotels
          currentAmount: 20000, // 20k saved, which satisfies the remaining 20k target!
          priority: 2,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'INR',
        availableBalance: 40000,
        currentBalance: 50000,
        monthlyCapacity: 5000,
        availableGoalCapacity: 2000,
        monthlySavings: 5000,
        currentMonthSavingsRate: 25,
        savingsRateChange: 0,
        efIsComplete: true,
        efTarget: 10000,
        efMonthlyDrip: 0,
        efRatio: 0,
        goalsRatio: 1.0,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress(goals, signals);
      expect(result).toHaveLength(1);
      const goal = result[0];

      // Resultant target should be 50,000 - 30,000 = 20,000
      expect(goal.resultantTargetAmount).toBe(20000);
      expect(goal.resultantTargetAmountLabel).toBe('₹20,000');
      // Current amount is 20,000, meeting 100% of the resultant target!
      expect(goal.currentAmount).toBe(20000);
      expect(goal.progressPct).toBe(100);
      // Health is ahead of schedule since it is 100% funded considering spent amount!
      expect(goal.health).toBe('Ahead of Schedule');
    });

    it('sets progress to 100% and health to Ahead of Schedule when spentAmount >= targetAmount', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: 'fully-spent-goal',
          title: 'Fully Spent Goal',
          targetAmount: 15000,
          spentAmount: 16000, // Spent more than initial target
          currentAmount: 0,
          priority: 3,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'INR',
        availableBalance: 10000,
        currentBalance: 20000,
        monthlyCapacity: 3000,
        availableGoalCapacity: 1000,
        monthlySavings: 3000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 0,
        efIsComplete: true,
        efTarget: 10000,
        efMonthlyDrip: 0,
        efRatio: 0,
        goalsRatio: 1.0,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress(goals, signals);
      const goal = result[0];

      expect(goal.resultantTargetAmount).toBe(0);
      expect(goal.progressPct).toBe(100);
      expect(goal.health).toBe('Ahead of Schedule');
    });

    it('handles empty goals array', () => {
      const signals: GoalProgressSignals = {
        currency: 'USD',
        availableBalance: 10000,
        currentBalance: 15000,
        monthlyCapacity: 2000,
        availableGoalCapacity: 600,
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: true,
        efTarget: 5000,
        efMonthlyDrip: 0,
        efRatio: 0,
        goalsRatio: 1.0,
        efStrategy: 'BALANCED',
      };

      const result = deriveGoalProgress([], signals);
      expect(result).toEqual([]);
    });
  });
});
