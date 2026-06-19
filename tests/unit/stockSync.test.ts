// tests/unit/stockSync.test.ts
// Unit tests for src/lib/inventory/stockSync.ts — pure functions, no mocks.

import {
  classifyStockStatus,
  sumRemainingQuantity,
  applyAdjustment,
  allocateFefoDeduction,
} from '@/lib/inventory/stockSync';

// ─────────────────────────────────────────────────────────────────
// classifyStockStatus
// ─────────────────────────────────────────────────────────────────

describe('classifyStockStatus', () => {
  test('returns out_of_stock for zero quantity', () => {
    expect(classifyStockStatus(0, 10)).toBe('out_of_stock');
  });

  test('returns out_of_stock for negative quantity (defensive)', () => {
    expect(classifyStockStatus(-5, 10)).toBe('out_of_stock');
  });

  test('returns low_stock when quantity is at the threshold', () => {
    expect(classifyStockStatus(10, 10)).toBe('low_stock');
  });

  test('returns low_stock when quantity is below the threshold', () => {
    expect(classifyStockStatus(5, 10)).toBe('low_stock');
  });

  test('returns low_stock for quantity of 1 with threshold 10', () => {
    expect(classifyStockStatus(1, 10)).toBe('low_stock');
  });

  test('returns in_stock when quantity exceeds the threshold', () => {
    expect(classifyStockStatus(11, 10)).toBe('in_stock');
  });

  test('returns in_stock for a large quantity', () => {
    expect(classifyStockStatus(1000, 10)).toBe('in_stock');
  });

  test('handles a zero threshold — any positive quantity is in_stock', () => {
    expect(classifyStockStatus(1, 0)).toBe('in_stock');
    expect(classifyStockStatus(0, 0)).toBe('out_of_stock');
  });
});

// ─────────────────────────────────────────────────────────────────
// sumRemainingQuantity
// ─────────────────────────────────────────────────────────────────

describe('sumRemainingQuantity', () => {
  test('sums multiple batches', () => {
    expect(sumRemainingQuantity([
      { remainingQty: 10 }, { remainingQty: 5 }, { remainingQty: 0 },
    ])).toBe(15);
  });

  test('returns 0 for empty array', () => {
    expect(sumRemainingQuantity([])).toBe(0);
  });

  test('returns single batch value', () => {
    expect(sumRemainingQuantity([{ remainingQty: 42 }])).toBe(42);
  });

  test('handles all-zero batches', () => {
    expect(sumRemainingQuantity([{ remainingQty: 0 }, { remainingQty: 0 }])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// applyAdjustment
// ─────────────────────────────────────────────────────────────────

describe('applyAdjustment', () => {
  test('adds a positive delta', () => {
    expect(applyAdjustment(10, 5)).toBe(15);
  });

  test('subtracts a negative delta', () => {
    expect(applyAdjustment(10, -3)).toBe(7);
  });

  test('clamps at zero rather than going negative', () => {
    expect(applyAdjustment(5, -10)).toBe(0);
  });

  test('exact zero-out is allowed', () => {
    expect(applyAdjustment(10, -10)).toBe(0);
  });

  test('zero delta is a no-op', () => {
    expect(applyAdjustment(10, 0)).toBe(10);
  });

  test('starting from zero with positive delta', () => {
    expect(applyAdjustment(0, 20)).toBe(20);
  });
});

// ─────────────────────────────────────────────────────────────────
// allocateFefoDeduction
// ─────────────────────────────────────────────────────────────────

describe('allocateFefoDeduction — basic allocation', () => {
  test('deducts fully from the first batch when it has enough', () => {
    const batches = [{ id: 'b1', remainingQty: 100 }, { id: 'b2', remainingQty: 50 }];
    const result = allocateFefoDeduction(batches, 30);
    expect(result.deductions).toEqual([{ batchId: 'b1', deduct: 30 }]);
    expect(result.shortfall).toBe(0);
  });

  test('spills into the second batch when first is insufficient', () => {
    const batches = [{ id: 'b1', remainingQty: 10 }, { id: 'b2', remainingQty: 50 }];
    const result = allocateFefoDeduction(batches, 30);
    expect(result.deductions).toEqual([
      { batchId: 'b1', deduct: 10 },
      { batchId: 'b2', deduct: 20 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  test('spans three batches when needed', () => {
    const batches = [
      { id: 'b1', remainingQty: 5 },
      { id: 'b2', remainingQty: 5 },
      { id: 'b3', remainingQty: 5 },
    ];
    const result = allocateFefoDeduction(batches, 12);
    expect(result.deductions).toEqual([
      { batchId: 'b1', deduct: 5 },
      { batchId: 'b2', deduct: 5 },
      { batchId: 'b3', deduct: 2 },
    ]);
    expect(result.shortfall).toBe(0);
  });

  test('respects FEFO order — assumes batches array is pre-sorted earliest-expiry-first', () => {
    // caller is responsible for sort order; this just confirms allocation
    // walks the array in the order given
    const batches = [
      { id: 'expires-soon', remainingQty: 3 },
      { id: 'expires-later', remainingQty: 100 },
    ];
    const result = allocateFefoDeduction(batches, 5);
    expect(result.deductions[0]).toEqual({ batchId: 'expires-soon', deduct: 3 });
    expect(result.deductions[1]).toEqual({ batchId: 'expires-later', deduct: 2 });
  });
});

describe('allocateFefoDeduction — edge cases', () => {
  test('skips batches with zero remaining', () => {
    const batches = [{ id: 'empty', remainingQty: 0 }, { id: 'full', remainingQty: 20 }];
    const result = allocateFefoDeduction(batches, 10);
    expect(result.deductions).toEqual([{ batchId: 'full', deduct: 10 }]);
  });

  test('returns shortfall when total stock is insufficient', () => {
    const batches = [{ id: 'b1', remainingQty: 5 }];
    const result = allocateFefoDeduction(batches, 10);
    expect(result.deductions).toEqual([{ batchId: 'b1', deduct: 5 }]);
    expect(result.shortfall).toBe(5);
  });

  test('returns full shortfall for empty batch list', () => {
    const result = allocateFefoDeduction([], 10);
    expect(result.deductions).toEqual([]);
    expect(result.shortfall).toBe(10);
  });

  test('requesting exactly zero produces no deductions', () => {
    const batches = [{ id: 'b1', remainingQty: 10 }];
    const result = allocateFefoDeduction(batches, 0);
    expect(result.deductions).toEqual([]);
    expect(result.shortfall).toBe(0);
  });

  test('exact match across all batches leaves no shortfall', () => {
    const batches = [{ id: 'b1', remainingQty: 10 }, { id: 'b2', remainingQty: 10 }];
    const result = allocateFefoDeduction(batches, 20);
    expect(result.shortfall).toBe(0);
    expect(result.deductions.reduce((s, d) => s + d.deduct, 0)).toBe(20);
  });

  test('stops processing batches once request is fully satisfied', () => {
    const batches = [
      { id: 'b1', remainingQty: 50 },
      { id: 'b2', remainingQty: 50 },
      { id: 'b3', remainingQty: 50 },
    ];
    const result = allocateFefoDeduction(batches, 10);
    expect(result.deductions).toHaveLength(1);
    expect(result.deductions[0]).toEqual({ batchId: 'b1', deduct: 10 });
  });
});
