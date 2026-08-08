import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTransactionImpact, updateProfileBalanceBy, getTransactionsNetImpact, getLast30DaysNetImpact } from './balance';
import { prisma } from '../lib/prisma';

// Mock prisma client
vi.mock('../lib/prisma', () => ({
  prisma: {
    financialProfile: {
      update: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
  },
}));

describe('balance service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTransactionImpact', () => {
    it('calculates credit impact correctly', () => {
      expect(getTransactionImpact(100, 'SALARY')).toBe(100);
      expect(getTransactionImpact(50, null, 'CREDIT')).toBe(50);
    });

    it('calculates debit impact correctly', () => {
      expect(getTransactionImpact(100, 'EXPENSE')).toBe(-100);
      expect(getTransactionImpact(75, null, 'WITHDRAWAL')).toBe(-75);
    });

    it('defaults to debit for unknown types', () => {
      expect(getTransactionImpact(100, 'UNKNOWN')).toBe(-100);
    });
  });

  describe('updateProfileBalanceBy', () => {
    it('updates profile balance with delta', async () => {
      await updateProfileBalanceBy(50);
      
      expect(prisma.financialProfile.update).toHaveBeenCalledWith({
        where: { id: "default" },
        data: { balance: { increment: 50 } },
      });
    });

    it('does not update if delta is zero or invalid', async () => {
      await updateProfileBalanceBy(0);
      expect(prisma.financialProfile.update).not.toHaveBeenCalled();

      await updateProfileBalanceBy(NaN);
      expect(prisma.financialProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionsNetImpact', () => {
    it('calculates net impact correctly based on aggregations', async () => {
      // Mock the credit sum response
      (prisma.transaction.aggregate as any)
        .mockResolvedValueOnce({ _sum: { amount: 500 } }) // First call: credits
        .mockResolvedValueOnce({ _sum: { amount: 1200 } }); // Second call: total

      const netImpact = await getTransactionsNetImpact();
      
      // Credits = 500, Total = 1200, Debits = 1200 - 500 = 700
      // Net Impact = Credits - Debits = 500 - 700 = -200
      expect(netImpact).toBe(-200);
    });
  });

  describe('getLast30DaysNetImpact', () => {
    it('queries transactions over the last 30 days', async () => {
      (prisma.transaction.aggregate as any)
        .mockResolvedValueOnce({ _sum: { amount: 1000 } })
        .mockResolvedValueOnce({ _sum: { amount: 1000 } });

      const netImpact = await getLast30DaysNetImpact();
      expect(netImpact).toBe(1000);
      expect(prisma.transaction.aggregate).toHaveBeenCalledTimes(2);
    });
  });
});
