// tests/unit/billMath.test.ts
// Unit tests for src/lib/billing/billMath.ts — pure functions, no mocks.

import {
  calculateTax,
  calculateLineTotal,
  calculateBillTotals,
  calculateChange,
  generateBillNumber,
} from '@/lib/billing/billMath';

// ─────────────────────────────────────────────────────────────────
// calculateTax
// ─────────────────────────────────────────────────────────────────

describe('calculateTax — SINGLE mode', () => {
  test('calculates flat tax percent correctly', () => {
    const result = calculateTax(1000, { taxType: 'SINGLE', taxPercent: 18, cgst: 0, sgst: 0 });
    expect(result.taxAmount).toBe(180);
    expect(result.cgstAmount).toBeUndefined();
    expect(result.sgstAmount).toBeUndefined();
  });

  test('returns zero tax for zero taxable amount', () => {
    const result = calculateTax(0, { taxType: 'SINGLE', taxPercent: 18, cgst: 0, sgst: 0 });
    expect(result.taxAmount).toBe(0);
  });

  test('returns zero tax for negative taxable amount (defensive)', () => {
    const result = calculateTax(-50, { taxType: 'SINGLE', taxPercent: 18, cgst: 0, sgst: 0 });
    expect(result.taxAmount).toBe(0);
  });

  test('rounds to 2 decimal places', () => {
    const result = calculateTax(99.99, { taxType: 'SINGLE', taxPercent: 18, cgst: 0, sgst: 0 });
    expect(result.taxAmount).toBe(18); // 99.99 * 0.18 = 17.9982 -> 18.00
  });

  test('handles zero percent tax', () => {
    const result = calculateTax(1000, { taxType: 'SINGLE', taxPercent: 0, cgst: 0, sgst: 0 });
    expect(result.taxAmount).toBe(0);
  });
});

describe('calculateTax — SPLIT mode (CGST + SGST)', () => {
  test('calculates cgst and sgst separately and sums into taxAmount', () => {
    const result = calculateTax(1000, { taxType: 'SPLIT', taxPercent: 0, cgst: 9, sgst: 9 });
    expect(result.cgstAmount).toBe(90);
    expect(result.sgstAmount).toBe(90);
    expect(result.taxAmount).toBe(180);
  });

  test('handles asymmetric cgst/sgst rates', () => {
    const result = calculateTax(1000, { taxType: 'SPLIT', taxPercent: 0, cgst: 6, sgst: 12 });
    expect(result.cgstAmount).toBe(60);
    expect(result.sgstAmount).toBe(120);
    expect(result.taxAmount).toBe(180);
  });

  test('returns zero split tax for zero taxable amount', () => {
    const result = calculateTax(0, { taxType: 'SPLIT', taxPercent: 0, cgst: 9, sgst: 9 });
    expect(result.taxAmount).toBe(0);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
  });

  test('rounds each component independently before summing', () => {
    const result = calculateTax(33.33, { taxType: 'SPLIT', taxPercent: 0, cgst: 9, sgst: 9 });
    // 33.33 * 0.09 = 2.9997 -> 3.00 each, sum 6.00
    expect(result.cgstAmount).toBe(3);
    expect(result.sgstAmount).toBe(3);
    expect(result.taxAmount).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateLineTotal
// ─────────────────────────────────────────────────────────────────

describe('calculateLineTotal', () => {
  test('calculates basic price * quantity', () => {
    expect(calculateLineTotal(100, 3, 0)).toBe(300);
  });

  test('subtracts line discount', () => {
    expect(calculateLineTotal(100, 3, 50)).toBe(250);
  });

  test('clamps at zero when discount exceeds line value', () => {
    expect(calculateLineTotal(100, 1, 500)).toBe(0);
  });

  test('handles single quantity', () => {
    expect(calculateLineTotal(299, 1, 0)).toBe(299);
  });

  test('handles fractional unit price correctly', () => {
    expect(calculateLineTotal(99.99, 2, 0)).toBe(199.98);
  });

  test('rounds to 2 decimal places', () => {
    expect(calculateLineTotal(33.333, 3, 0)).toBe(100); // 99.999 -> rounds to 100.00
  });

  test('zero quantity produces zero total', () => {
    // not a realistic input (schema requires positive), but function should be safe
    expect(calculateLineTotal(100, 0, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateBillTotals
// ─────────────────────────────────────────────────────────────────

const SINGLE_18 = { taxType: 'SINGLE' as const, taxPercent: 18, cgst: 0, sgst: 0 };
const SPLIT_9_9 = { taxType: 'SPLIT' as const, taxPercent: 0, cgst: 9, sgst: 9 };

describe('calculateBillTotals — basic scenarios', () => {
  test('single line, no discount, SINGLE tax', () => {
    const result = calculateBillTotals([300], 0, SINGLE_18);
    expect(result.subtotal).toBe(300);
    expect(result.effectiveDiscount).toBe(0);
    expect(result.taxableAmount).toBe(300);
    expect(result.taxAmount).toBe(54);
    expect(result.total).toBe(354);
  });

  test('multiple lines sum correctly', () => {
    const result = calculateBillTotals([100, 200, 50], 0, SINGLE_18);
    expect(result.subtotal).toBe(350);
  });

  test('bill-level discount reduces taxable amount before tax', () => {
    const result = calculateBillTotals([1000], 100, SINGLE_18);
    expect(result.subtotal).toBe(1000);
    expect(result.effectiveDiscount).toBe(100);
    expect(result.taxableAmount).toBe(900);
    expect(result.taxAmount).toBe(162); // 900 * 0.18
    expect(result.total).toBe(1062);
  });

  test('SPLIT tax mode includes cgst/sgst breakdown in bill totals', () => {
    const result = calculateBillTotals([1000], 0, SPLIT_9_9);
    expect(result.cgstAmount).toBe(90);
    expect(result.sgstAmount).toBe(90);
    expect(result.taxAmount).toBe(180);
    expect(result.total).toBe(1180);
  });

  test('SINGLE tax mode does not include cgst/sgst keys', () => {
    const result = calculateBillTotals([1000], 0, SINGLE_18);
    expect(result.cgstAmount).toBeUndefined();
    expect(result.sgstAmount).toBeUndefined();
  });
});

describe('calculateBillTotals — discount clamping', () => {
  test('clamps bill discount that exceeds subtotal', () => {
    const result = calculateBillTotals([100], 500, SINGLE_18);
    expect(result.effectiveDiscount).toBe(100); // clamped to subtotal
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  test('exact discount-equals-subtotal results in zero tax and total', () => {
    const result = calculateBillTotals([200], 200, SINGLE_18);
    expect(result.taxableAmount).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('calculateBillTotals — empty cart', () => {
  test('empty line array produces all-zero totals', () => {
    const result = calculateBillTotals([], 0, SINGLE_18);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateChange
// ─────────────────────────────────────────────────────────────────

describe('calculateChange', () => {
  test('calculates change for overpayment', () => {
    expect(calculateChange(354, 400)).toBe(46);
  });

  test('returns zero for exact payment', () => {
    expect(calculateChange(354, 354)).toBe(0);
  });

  test('returns zero for underpayment (not negative)', () => {
    expect(calculateChange(354, 300)).toBe(0);
  });

  test('handles fractional amounts', () => {
    expect(calculateChange(99.50, 100)).toBe(0.5);
  });
});

// ─────────────────────────────────────────────────────────────────
// generateBillNumber
// ─────────────────────────────────────────────────────────────────

describe('generateBillNumber', () => {
  test('formats as INV-YYYYMMDD-NNN with zero-padded sequence', () => {
    const date = new Date(2026, 5, 19); // June 19, 2026 (month is 0-indexed)
    expect(generateBillNumber(date, 1)).toBe('INV-20260619-001');
  });

  test('zero-pads single and double digit sequences to 3 digits', () => {
    const date = new Date(2026, 0, 1);
    expect(generateBillNumber(date, 5)).toBe('INV-20260101-005');
    expect(generateBillNumber(date, 42)).toBe('INV-20260101-042');
  });

  test('does not truncate sequences beyond 999', () => {
    const date = new Date(2026, 0, 1);
    expect(generateBillNumber(date, 1000)).toBe('INV-20260101-1000');
  });

  test('zero-pads month and day correctly', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(generateBillNumber(date, 1)).toBe('INV-20260105-001');
  });

  test('produces different numbers for different dates with same sequence', () => {
    const d1 = generateBillNumber(new Date(2026, 5, 19), 1);
    const d2 = generateBillNumber(new Date(2026, 5, 20), 1);
    expect(d1).not.toBe(d2);
  });
});
