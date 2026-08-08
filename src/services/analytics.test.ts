import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spendingHeatmap } from './analytics';
import { prisma } from '../lib/prisma';

vi.mock('../lib/prisma', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
    },
  },
}));

describe('spendingHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches local date strings with local weekdays without UTC timezone offset shift', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

    const result = await spendingHeatmap(7);
    expect(result).toHaveLength(7);

    for (const item of result) {
      const [y, m, d] = item.date.split('-').map(Number);
      const expectedDate = new Date(y, m - 1, d);
      expect(item.weekday).toBe(expectedDate.getDay());
    }
  });
});
