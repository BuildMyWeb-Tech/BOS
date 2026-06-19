// tests/unit/availability-validation.test.ts
// Unit tests for Phase 3C availability query schemas

import {
  availabilityQuerySchema,
  availabilityRangeQuerySchema,
  validate,
} from '@/lib/validation';

const VALID_CUID = 'clx0a1b2c0000a1b2c3d4e5f6'; // 25-char cuid-shaped string

describe('availabilityQuerySchema', () => {
  test('accepts valid serviceId + date (no staffId)', () => {
    expect(availabilityQuerySchema.safeParse({
      serviceId: VALID_CUID, date: '2026-06-20',
    }).success).toBe(true);
  });

  test('accepts valid serviceId + staffId + date', () => {
    expect(availabilityQuerySchema.safeParse({
      serviceId: VALID_CUID, staffId: VALID_CUID, date: '2026-06-20',
    }).success).toBe(true);
  });

  test('rejects missing serviceId', () => {
    expect(availabilityQuerySchema.safeParse({ date: '2026-06-20' }).success).toBe(false);
  });

  test('rejects missing date', () => {
    expect(availabilityQuerySchema.safeParse({ serviceId: VALID_CUID }).success).toBe(false);
  });

  test('rejects invalid date format', () => {
    expect(availabilityQuerySchema.safeParse({
      serviceId: VALID_CUID, date: '20-06-2026',
    }).success).toBe(false);
  });

  test('rejects non-cuid serviceId', () => {
    expect(availabilityQuerySchema.safeParse({
      serviceId: 'not-a-cuid', date: '2026-06-20',
    }).success).toBe(false);
  });

  test('rejects non-cuid staffId', () => {
    expect(availabilityQuerySchema.safeParse({
      serviceId: VALID_CUID, staffId: 'bad-id', date: '2026-06-20',
    }).success).toBe(false);
  });
});

describe('availabilityRangeQuerySchema', () => {
  const base = { serviceId: VALID_CUID, from: '2026-06-01', to: '2026-06-30' };

  test('accepts a valid 30-day range', () => {
    expect(availabilityRangeQuerySchema.safeParse(base).success).toBe(true);
  });

  test('accepts a single-day range (from === to)', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, from: '2026-06-15', to: '2026-06-15',
    }).success).toBe(true);
  });

  test('accepts with optional staffId', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, staffId: VALID_CUID,
    }).success).toBe(true);
  });

  test('rejects "to" before "from"', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, from: '2026-06-30', to: '2026-06-01',
    }).success).toBe(false);
  });

  test('rejects range exceeding 90 days', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, from: '2026-01-01', to: '2026-12-31',
    }).success).toBe(false);
  });

  test('accepts range of exactly 90 days', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, from: '2026-01-01', to: '2026-04-01', // 90 days inclusive
    }).success).toBe(true);
  });

  test('rejects missing serviceId', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      from: '2026-06-01', to: '2026-06-30',
    }).success).toBe(false);
  });

  test('rejects invalid date format in "from"', () => {
    expect(availabilityRangeQuerySchema.safeParse({
      ...base, from: 'June 1 2026',
    }).success).toBe(false);
  });
});

describe('validate() with availability schemas', () => {
  test('returns structured errors for invalid availability query', () => {
    const result = validate(availabilityQuerySchema, { serviceId: 'bad', date: 'bad-date' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('serviceId');
    expect(result.errors).toHaveProperty('date');
  });
});
