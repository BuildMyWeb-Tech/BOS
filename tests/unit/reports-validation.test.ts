// tests/unit/reports-validation.test.ts
// Unit tests for Phase 8 schemas in validation.ts

import {
  revenueReportQuerySchema,
  salesSummaryQuerySchema,
  customerReportQuerySchema,
  staffPerformanceQuerySchema,
  inventoryReportQuerySchema,
  exportReportSchema,
  validate,
} from '@/lib/validation';

// ─── revenueReportQuerySchema ────────────────────────────────────────

describe('revenueReportQuerySchema', () => {
  test('accepts valid range with default bucket', () => {
    const r = revenueReportQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.bucket).toBe('day');
  });
  test('accepts explicit bucket', () => {
    expect(revenueReportQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30', bucket: 'month' }).success).toBe(true);
  });
  test('rejects invalid bucket', () => {
    expect(revenueReportQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30', bucket: 'year' }).success).toBe(false);
  });
  test('rejects to before from', () => {
    expect(revenueReportQuerySchema.safeParse({ from: '2026-06-30', to: '2026-06-01' }).success).toBe(false);
  });
  test('rejects range exceeding 366 days', () => {
    expect(revenueReportQuerySchema.safeParse({ from: '2025-01-01', to: '2026-12-31' }).success).toBe(false);
  });
  test('accepts a 366-day range (leap year boundary)', () => {
    expect(revenueReportQuerySchema.safeParse({ from: '2026-01-01', to: '2026-12-31' }).success).toBe(true);
  });
  test('rejects missing from', () => {
    expect(revenueReportQuerySchema.safeParse({ to: '2026-06-30' }).success).toBe(false);
  });
});

// ─── salesSummaryQuerySchema ──────────────────────────────────────────

describe('salesSummaryQuerySchema', () => {
  test('accepts valid range with default limit', () => {
    const r = salesSummaryQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(10);
  });
  test('coerces string limit to number', () => {
    const r = salesSummaryQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30', limit: '5' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(5);
  });
  test('rejects limit over 50', () => {
    expect(salesSummaryQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30', limit: '100' }).success).toBe(false);
  });
  test('rejects limit of 0', () => {
    expect(salesSummaryQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30', limit: '0' }).success).toBe(false);
  });
});

// ─── customerReportQuerySchema ────────────────────────────────────────

describe('customerReportQuerySchema', () => {
  test('accepts valid input', () => {
    expect(customerReportQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' }).success).toBe(true);
  });
  test('rejects to before from', () => {
    expect(customerReportQuerySchema.safeParse({ from: '2026-06-30', to: '2026-06-01' }).success).toBe(false);
  });
});

// ─── staffPerformanceQuerySchema ──────────────────────────────────────

describe('staffPerformanceQuerySchema', () => {
  test('accepts valid range', () => {
    expect(staffPerformanceQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' }).success).toBe(true);
  });
  test('rejects missing to', () => {
    expect(staffPerformanceQuerySchema.safeParse({ from: '2026-06-01' }).success).toBe(false);
  });
});

// ─── inventoryReportQuerySchema ───────────────────────────────────────

describe('inventoryReportQuerySchema', () => {
  test('accepts empty query with default deadStockDays', () => {
    const r = inventoryReportQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deadStockDays).toBe(90);
  });
  test('coerces string deadStockDays', () => {
    const r = inventoryReportQuerySchema.safeParse({ deadStockDays: '30' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deadStockDays).toBe(30);
  });
  test('rejects deadStockDays over 365', () => {
    expect(inventoryReportQuerySchema.safeParse({ deadStockDays: '400' }).success).toBe(false);
  });
  test('rejects deadStockDays of 0', () => {
    expect(inventoryReportQuerySchema.safeParse({ deadStockDays: '0' }).success).toBe(false);
  });
});

// ─── exportReportSchema ───────────────────────────────────────────────

describe('exportReportSchema', () => {
  test('accepts inventory export without date range', () => {
    expect(exportReportSchema.safeParse({ reportType: 'inventory' }).success).toBe(true);
  });
  test('accepts revenue export with date range', () => {
    expect(exportReportSchema.safeParse({
      reportType: 'revenue', from: '2026-06-01', to: '2026-06-30',
    }).success).toBe(true);
  });
  test('rejects revenue export without date range', () => {
    expect(exportReportSchema.safeParse({ reportType: 'revenue' }).success).toBe(false);
  });
  test('rejects sales-summary export without date range', () => {
    expect(exportReportSchema.safeParse({ reportType: 'sales-summary' }).success).toBe(false);
  });
  test('rejects invalid reportType', () => {
    expect(exportReportSchema.safeParse({ reportType: 'profit-margin' }).success).toBe(false);
  });
  test('rejects to before from', () => {
    expect(exportReportSchema.safeParse({
      reportType: 'revenue', from: '2026-06-30', to: '2026-06-01',
    }).success).toBe(false);
  });
  test('accepts each valid reportType with required dates where needed', () => {
    const types = ['revenue', 'sales-summary', 'customers', 'staff-performance'];
    for (const reportType of types) {
      expect(exportReportSchema.safeParse({
        reportType, from: '2026-06-01', to: '2026-06-30',
      }).success).toBe(true);
    }
  });
});

// ─── validate() integration ──────────────────────────────────────────

describe('validate() with reporting schemas', () => {
  test('returns structured errors for invalid revenue query', () => {
    const result = validate(revenueReportQuerySchema, { from: '2026-06-30', to: '2026-06-01' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('to');
  });
});
