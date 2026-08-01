import { describe, it, expect, vi } from 'vitest';
import { deriveGoalProgress, GoalProgressSeed, GoalProgressSignals } from './goalProgress';

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
  describe('deriveGoalProgress', () => {
    it('calculates goal progress correctly with given signals', () => {
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
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: true,
        efTarget: 5000,
      };

      const result = deriveGoalProgress(goals, signals);

      expect(result).toHaveLength(1);
      const goal = result[0];

      expect(goal.id).toBe('1');
      // currentAmount must equal the confirmed DB seed value — no phantom inflation
      expect(goal.currentAmount).toBe(5000);
      expect(goal.derivedCurrentAmount).toBe(5000);
      expect(goal.health).toBe('ON_TRACK');
      expect(goal.confidenceScore).toBe(0.9);
      expect(goal.requiredMonthly).toBe(500);
    });

    it('returns zero currentAmount for a brand-new goal with no savings yet', () => {
      const goals: GoalProgressSeed[] = [
        {
          id: '2',
          title: 'Emergency vacation',
          targetAmount: 30000,
          currentAmount: 0,
          priority: 2,
        },
      ];

      const signals: GoalProgressSignals = {
        currency: 'USD',
        availableBalance: 0,          // EF not yet complete — nothing available for goals
        currentBalance: 15000,
        monthlyCapacity: 2000,
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: false,
        efTarget: 15000,
      };

      const result = deriveGoalProgress(goals, signals);
      expect(result).toHaveLength(1);
      // Must be exactly 0 — no phantom allocation from EF balance
      expect(result[0].currentAmount).toBe(0);
      expect(result[0].progressPct).toBe(0);
    });

    it('handles empty goals array', () => {
      const signals: GoalProgressSignals = {
        currency: 'USD',
        availableBalance: 10000,
        currentBalance: 15000,
        monthlyCapacity: 2000,
        monthlySavings: 2000,
        currentMonthSavingsRate: 20,
        savingsRateChange: 2,
        efIsComplete: true,
        efTarget: 5000,
      };

      const result = deriveGoalProgress([], signals);
      expect(result).toEqual([]);
    });
  });
});
