// tests/unit/holiday-validation.test.ts
// Unit tests for Phase 3B holiday schemas in validation.ts

import {
  blockedDateSchema,
  recurringHolidaySchema,
  updateRecurringHolidaySchema,
  specialWorkingDaySchema,
  calendarQuerySchema,
  validate,
} from '@/lib/validation';

// ─── blockedDateSchema ─────────────────────────────────────────────

describe('blockedDateSchema', () => {
  test('accepts valid date', () => {
    expect(blockedDateSchema.safeParse({ date: '2025-12-25' }).success).toBe(true);
  });
  test('accepts date with reason', () => {
    expect(blockedDateSchema.safeParse({ date: '2025-12-25', reason: 'Christmas' }).success).toBe(true);
  });
  test('rejects invalid date format', () => {
    expect(blockedDateSchema.safeParse({ date: '25-12-2025' }).success).toBe(false);
    expect(blockedDateSchema.safeParse({ date: '2025/12/25' }).success).toBe(false);
  });
  test('rejects missing date', () => {
    expect(blockedDateSchema.safeParse({}).success).toBe(false);
  });
  test('rejects reason longer than 200 chars', () => {
    expect(blockedDateSchema.safeParse({ date: '2025-12-25', reason: 'X'.repeat(201) }).success).toBe(false);
  });
  test('trims reason', () => {
    const r = blockedDateSchema.safeParse({ date: '2025-12-25', reason: '  Christmas  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBe('Christmas');
  });
});

// ─── recurringHolidaySchema ─────────────────────────────────────────

describe('recurringHolidaySchema — weekly', () => {
  test('accepts valid weekly holiday', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Weekly Off', type: 'weekly', value: 'Sunday',
    }).success).toBe(true);
  });
  test('accepts all valid weekday names', () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (const day of days) {
      expect(recurringHolidaySchema.safeParse({
        name: 'Weekly Off', type: 'weekly', value: day,
      }).success).toBe(true);
    }
  });
  test('rejects invalid weekday name', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Weekly Off', type: 'weekly', value: 'Someday',
    }).success).toBe(false);
  });
  test('rejects abbreviated day name', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Weekly Off', type: 'weekly', value: 'Mon',
    }).success).toBe(false);
  });
});

describe('recurringHolidaySchema — monthly', () => {
  test('accepts valid day-of-month', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Monthly Closure', type: 'monthly', value: '15',
    }).success).toBe(true);
  });
  test('accepts day 1', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'First of Month', type: 'monthly', value: '1',
    }).success).toBe(true);
  });
  test('accepts day 31', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Last possible day', type: 'monthly', value: '31',
    }).success).toBe(true);
  });
  test('rejects day 0', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Invalid', type: 'monthly', value: '0',
    }).success).toBe(false);
  });
  test('rejects day 32', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Invalid', type: 'monthly', value: '32',
    }).success).toBe(false);
  });
  test('rejects non-numeric value', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Invalid', type: 'monthly', value: 'fifteen',
    }).success).toBe(false);
  });
  test('rejects decimal value', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'Invalid', type: 'monthly', value: '15.5',
    }).success).toBe(false);
  });
});

describe('recurringHolidaySchema — general', () => {
  test('rejects invalid type', () => {
    expect(recurringHolidaySchema.safeParse({
      name: 'X', type: 'yearly', value: 'Sunday',
    }).success).toBe(false);
  });
  test('rejects missing name', () => {
    expect(recurringHolidaySchema.safeParse({ type: 'weekly', value: 'Sunday' }).success).toBe(false);
  });
  test('rejects name shorter than 2 chars', () => {
    expect(recurringHolidaySchema.safeParse({ name: 'X', type: 'weekly', value: 'Sunday' }).success).toBe(false);
  });
});

describe('updateRecurringHolidaySchema', () => {
  test('accepts name-only update', () => {
    expect(updateRecurringHolidaySchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateRecurringHolidaySchema.safeParse({}).success).toBe(false);
  });
  test('validates value against type when both provided', () => {
    expect(updateRecurringHolidaySchema.safeParse({ type: 'weekly', value: 'NotADay' }).success).toBe(false);
  });
  test('accepts valid type+value combo', () => {
    expect(updateRecurringHolidaySchema.safeParse({ type: 'monthly', value: '10' }).success).toBe(true);
  });
});

// ─── specialWorkingDaySchema ────────────────────────────────────────

describe('specialWorkingDaySchema', () => {
  test('accepts valid date', () => {
    expect(specialWorkingDaySchema.safeParse({ date: '2025-12-26' }).success).toBe(true);
  });
  test('rejects invalid format', () => {
    expect(specialWorkingDaySchema.safeParse({ date: 'Dec 26 2025' }).success).toBe(false);
  });
  test('rejects missing date', () => {
    expect(specialWorkingDaySchema.safeParse({}).success).toBe(false);
  });
});

// ─── calendarQuerySchema ────────────────────────────────────────────

describe('calendarQuerySchema', () => {
  test('coerces string year/month to numbers', () => {
    const r = calendarQuerySchema.safeParse({ year: '2026', month: '6' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.year).toBe(2026);
      expect(r.data.month).toBe(6);
    }
  });
  test('rejects month 0', () => {
    expect(calendarQuerySchema.safeParse({ year: '2026', month: '0' }).success).toBe(false);
  });
  test('rejects month 13', () => {
    expect(calendarQuerySchema.safeParse({ year: '2026', month: '13' }).success).toBe(false);
  });
  test('rejects year below 2020', () => {
    expect(calendarQuerySchema.safeParse({ year: '2019', month: '6' }).success).toBe(false);
  });
  test('accepts boundary month 1 and 12', () => {
    expect(calendarQuerySchema.safeParse({ year: '2026', month: '1' }).success).toBe(true);
    expect(calendarQuerySchema.safeParse({ year: '2026', month: '12' }).success).toBe(true);
  });
});

// ─── validate() helper integration ──────────────────────────────────

describe('validate() with holiday schemas', () => {
  test('returns field errors for invalid recurring holiday', () => {
    const result = validate(recurringHolidaySchema, { name: 'X', type: 'weekly', value: 'BadDay' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('name');
    expect(result.errors).toHaveProperty('value');
  });
});
