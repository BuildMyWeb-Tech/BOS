// tests/unit/reportMath.test.ts
// Unit tests for src/lib/reports/reportMath.ts — pure functions, no mocks.

import {
  getBucketLabel,
  generateBucketSequence,
  bucketAmounts,
  calculateGrowthPercent,
  calculateAverageValue,
  rankTopItems,
} from '@/lib/reports/reportMath';

// ─────────────────────────────────────────────────────────────────
// getBucketLabel
// ─────────────────────────────────────────────────────────────────

describe('getBucketLabel — day', () => {
  test('formats as YYYY-MM-DD', () => {
    expect(getBucketLabel(new Date(2026, 5, 19), 'day')).toBe('2026-06-19');
  });
  test('zero-pads single-digit month and day', () => {
    expect(getBucketLabel(new Date(2026, 0, 5), 'day')).toBe('2026-01-05');
  });
});

describe('getBucketLabel — month', () => {
  test('formats as YYYY-MM', () => {
    expect(getBucketLabel(new Date(2026, 5, 19), 'month')).toBe('2026-06');
  });
  test('different days in same month produce same label', () => {
    expect(getBucketLabel(new Date(2026, 5, 1), 'month')).toBe(getBucketLabel(new Date(2026, 5, 30), 'month'));
  });
});

describe('getBucketLabel — week (ISO 8601)', () => {
  test('produces a YYYY-Www format', () => {
    const label = getBucketLabel(new Date(2026, 5, 19), 'week');
    expect(label).toMatch(/^\d{4}-W\d{2}$/);
  });
  test('same ISO week for consecutive days within it', () => {
    // June 15, 2026 is a Monday
    const monday = getBucketLabel(new Date(2026, 5, 15), 'week');
    const sunday = getBucketLabel(new Date(2026, 5, 21), 'week');
    expect(monday).toBe(sunday);
  });
  test('different weeks for dates 8 days apart', () => {
    const week1 = getBucketLabel(new Date(2026, 5, 15), 'week');
    const week2 = getBucketLabel(new Date(2026, 5, 23), 'week');
    expect(week1).not.toBe(week2);
  });
});

// ─────────────────────────────────────────────────────────────────
// generateBucketSequence
// ─────────────────────────────────────────────────────────────────

describe('generateBucketSequence', () => {
  test('produces one label per day for a day bucket', () => {
    const seq = generateBucketSequence('2026-06-01', '2026-06-05', 'day');
    expect(seq).toEqual(['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']);
  });
  test('single-day range produces one label', () => {
    const seq = generateBucketSequence('2026-06-01', '2026-06-01', 'day');
    expect(seq).toEqual(['2026-06-01']);
  });
  test('month bucket deduplicates days within the same month', () => {
    const seq = generateBucketSequence('2026-06-01', '2026-06-30', 'month');
    expect(seq).toEqual(['2026-06']);
  });
  test('month bucket spans multiple months correctly', () => {
    const seq = generateBucketSequence('2026-05-15', '2026-07-10', 'month');
    expect(seq).toEqual(['2026-05', '2026-06', '2026-07']);
  });
  test('week bucket deduplicates days within the same ISO week', () => {
    const seq = generateBucketSequence('2026-06-15', '2026-06-21', 'week'); // Mon-Sun
    expect(seq).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// bucketAmounts
// ─────────────────────────────────────────────────────────────────

describe('bucketAmounts', () => {
  test('sums amounts within the same day bucket', () => {
    const result = bucketAmounts([
      { date: new Date(2026, 5, 1, 9, 0),  amount: 100 },
      { date: new Date(2026, 5, 1, 15, 0), amount: 50 },
      { date: new Date(2026, 5, 2, 9, 0),  amount: 200 },
    ], 'day');
    expect(result.get('2026-06-01')).toBe(150);
    expect(result.get('2026-06-02')).toBe(200);
  });

  test('returns empty map for empty input', () => {
    const result = bucketAmounts([], 'day');
    expect(result.size).toBe(0);
  });

  test('aggregates correctly into month buckets', () => {
    const result = bucketAmounts([
      { date: new Date(2026, 5, 1),  amount: 100 },
      { date: new Date(2026, 5, 30), amount: 200 },
    ], 'month');
    expect(result.get('2026-06')).toBe(300);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateGrowthPercent
// ─────────────────────────────────────────────────────────────────

describe('calculateGrowthPercent', () => {
  test('calculates positive growth', () => {
    expect(calculateGrowthPercent(150, 100)).toBe(50);
  });
  test('calculates negative growth (decline)', () => {
    expect(calculateGrowthPercent(80, 100)).toBe(-20);
  });
  test('returns 0 for no change', () => {
    expect(calculateGrowthPercent(100, 100)).toBe(0);
  });
  test('returns null when previous period is zero (no baseline)', () => {
    expect(calculateGrowthPercent(100, 0)).toBeNull();
  });
  test('returns null when both are zero', () => {
    expect(calculateGrowthPercent(0, 0)).toBeNull();
  });
  test('rounds to 2 decimal places', () => {
    expect(calculateGrowthPercent(133, 100)).toBe(33);
    expect(calculateGrowthPercent(100, 3)).toBeCloseTo(3233.33, 1);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateAverageValue
// ─────────────────────────────────────────────────────────────────

describe('calculateAverageValue', () => {
  test('calculates basic average', () => {
    expect(calculateAverageValue(1000, 10)).toBe(100);
  });
  test('returns 0 for zero transactions (no division by zero)', () => {
    expect(calculateAverageValue(1000, 0)).toBe(0);
  });
  test('returns 0 when revenue is also 0', () => {
    expect(calculateAverageValue(0, 0)).toBe(0);
  });
  test('rounds to 2 decimal places', () => {
    expect(calculateAverageValue(100, 3)).toBe(33.33);
  });
  test('handles single transaction', () => {
    expect(calculateAverageValue(299.99, 1)).toBe(299.99);
  });
});

// ─────────────────────────────────────────────────────────────────
// rankTopItems
// ─────────────────────────────────────────────────────────────────

describe('rankTopItems', () => {
  const items = [
    { name: 'Shampoo', revenue: 500 },
    { name: 'Conditioner', revenue: 800 },
    { name: 'Soap', revenue: 200 },
  ];

  test('sorts by revenue descending', () => {
    const result = rankTopItems(items, 10);
    expect(result.map(r => r.name)).toEqual(['Conditioner', 'Shampoo', 'Soap']);
  });

  test('limits to the requested count', () => {
    const result = rankTopItems(items, 2);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.name)).toEqual(['Conditioner', 'Shampoo']);
  });

  test('limit larger than item count returns all items', () => {
    const result = rankTopItems(items, 100);
    expect(result).toHaveLength(3);
  });

  test('breaks ties by name ascending', () => {
    const tied = [
      { name: 'Zebra', revenue: 100 },
      { name: 'Apple', revenue: 100 },
    ];
    const result = rankTopItems(tied, 10);
    expect(result.map(r => r.name)).toEqual(['Apple', 'Zebra']);
  });

  test('does not mutate the original array', () => {
    const original = [...items];
    rankTopItems(items, 10);
    expect(items).toEqual(original);
  });

  test('handles empty input', () => {
    expect(rankTopItems([], 10)).toEqual([]);
  });
});
