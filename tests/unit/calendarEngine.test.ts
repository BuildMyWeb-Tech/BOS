// tests/unit/calendarEngine.test.ts
// Unit tests for src/lib/booking/calendarEngine.ts
// This is pure logic with zero DB dependency — tests run directly.

import { resolveCalendarMonth, isDateOpen } from '@/lib/booking/calendarEngine';
import type { DayOfWeek } from '@/types';

const WEEKDAYS_ONLY: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─────────────────────────────────────────────────────────────────
// resolveCalendarMonth
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — basic structure', () => {
  test('returns correct number of days for June 2026 (30 days)', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: WEEKDAYS_ONLY,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.days).toHaveLength(30);
  });

  test('returns correct number of days for February 2026 (28 days, not leap)', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 2, daysOpen: WEEKDAYS_ONLY,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.days).toHaveLength(28);
  });

  test('returns correct number of days for February 2028 (29 days, leap year)', () => {
    const result = resolveCalendarMonth({
      year: 2028, month: 2, daysOpen: WEEKDAYS_ONLY,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.days).toHaveLength(29);
  });

  test('echoes back year and month', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: WEEKDAYS_ONLY,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.year).toBe(2026);
    expect(result.month).toBe(6);
  });

  test('dates are formatted as YYYY-MM-DD with zero-padding', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.days[0].date).toBe('2026-06-01');
    expect(result.days[8].date).toBe('2026-06-09');
  });
});

// ─────────────────────────────────────────────────────────────────
// Step 1: daysOpen baseline
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — daysOpen baseline', () => {
  test('weekday-only schedule closes Saturdays and Sundays', () => {
    // June 2026: June 1 is a Monday
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: WEEKDAYS_ONLY,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    const saturday = result.days.find(d => d.date === '2026-06-06'); // Sat
    const sunday   = result.days.find(d => d.date === '2026-06-07'); // Sun
    expect(saturday?.isOpen).toBe(false);
    expect(sunday?.isOpen).toBe(false);
    expect(saturday?.source).toBe('not-in-days-open');
  });

  test('all-days-open schedule keeps every day open by default', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    expect(result.days.every(d => d.isOpen)).toBe(true);
  });

  test('correctly identifies dayOfWeek for known date', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], recurringHolidays: [], specialWorkingDays: [],
    });
    const june1 = result.days.find(d => d.date === '2026-06-01');
    expect(june1?.dayOfWeek).toBe('Monday'); // verified: June 1, 2026 is a Monday
  });
});

// ─────────────────────────────────────────────────────────────────
// Step 2 & 3: Recurring holidays (weekly + monthly)
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — recurring weekly holiday', () => {
  test('closes every occurrence of the weekday in the month', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], specialWorkingDays: [],
      recurringHolidays: [{ name: 'Sunday Off', type: 'weekly', value: 'Sunday' }],
    });
    const sundays = result.days.filter(d => d.dayOfWeek === 'Sunday');
    expect(sundays.length).toBeGreaterThan(0);
    expect(sundays.every(d => !d.isOpen)).toBe(true);
    expect(sundays[0].source).toBe('recurring-weekly');
    expect(sundays[0].reason).toContain('Sunday Off');
  });

  test('does not affect other weekdays', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], specialWorkingDays: [],
      recurringHolidays: [{ name: 'Sunday Off', type: 'weekly', value: 'Sunday' }],
    });
    const mondays = result.days.filter(d => d.dayOfWeek === 'Monday');
    expect(mondays.every(d => d.isOpen)).toBe(true);
  });
});

describe('resolveCalendarMonth — recurring monthly holiday', () => {
  test('closes the specific day-of-month', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], specialWorkingDays: [],
      recurringHolidays: [{ name: 'Mid-month closure', type: 'monthly', value: '15' }],
    });
    const day15 = result.days.find(d => d.date === '2026-06-15');
    expect(day15?.isOpen).toBe(false);
    expect(day15?.source).toBe('recurring-monthly');
  });

  test('does not affect other days', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [], specialWorkingDays: [],
      recurringHolidays: [{ name: 'Mid-month closure', type: 'monthly', value: '15' }],
    });
    const day14 = result.days.find(d => d.date === '2026-06-14');
    const day16 = result.days.find(d => d.date === '2026-06-16');
    expect(day14?.isOpen).toBe(true);
    expect(day16?.isOpen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// Step 4: Blocked dates
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — blocked dates', () => {
  test('closes a specific blocked date', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      recurringHolidays: [], specialWorkingDays: [],
      blockedDates: [{ date: '2026-06-20', reason: 'Festival' }],
    });
    const day20 = result.days.find(d => d.date === '2026-06-20');
    expect(day20?.isOpen).toBe(false);
    expect(day20?.reason).toBe('Festival');
    expect(day20?.source).toBe('blocked');
  });

  test('blocked date overrides daysOpen baseline (closes a normally-open day)', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS, // all days normally open
      recurringHolidays: [], specialWorkingDays: [],
      blockedDates: [{ date: '2026-06-10', reason: 'Emergency closure' }],
    });
    const day10 = result.days.find(d => d.date === '2026-06-10');
    expect(day10?.isOpen).toBe(false);
  });

  test('uses default reason if none provided', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      recurringHolidays: [], specialWorkingDays: [],
      blockedDates: [{ date: '2026-06-10', reason: null }],
    });
    const day10 = result.days.find(d => d.date === '2026-06-10');
    expect(day10?.reason).toBe('Blocked date');
  });
});

// ─────────────────────────────────────────────────────────────────
// Step 5: Special working days (highest priority — forces open)
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — special working days override', () => {
  test('forces open a day that is normally closed (weekend)', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: WEEKDAYS_ONLY, // weekends closed
      recurringHolidays: [], blockedDates: [],
      specialWorkingDays: [{ date: '2026-06-06' }], // Saturday
    });
    const sat = result.days.find(d => d.date === '2026-06-06');
    expect(sat?.isOpen).toBe(true);
    expect(sat?.source).toBe('special-override');
  });

  test('forces open a day that is closed due to recurring weekly holiday', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      blockedDates: [],
      recurringHolidays: [{ name: 'Sunday Off', type: 'weekly', value: 'Sunday' }],
      specialWorkingDays: [{ date: '2026-06-07' }], // a Sunday
    });
    const sun = result.days.find(d => d.date === '2026-06-07');
    expect(sun?.isOpen).toBe(true);
    expect(sun?.source).toBe('special-override');
  });

  test('forces open a day that is explicitly blocked — special override wins', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: ALL_DAYS,
      recurringHolidays: [],
      blockedDates:       [{ date: '2026-06-15', reason: 'Originally blocked' }],
      specialWorkingDays: [{ date: '2026-06-15' }],
    });
    const day15 = result.days.find(d => d.date === '2026-06-15');
    expect(day15?.isOpen).toBe(true);
    expect(day15?.source).toBe('special-override');
  });

  test('does not affect days not explicitly marked special', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6, daysOpen: WEEKDAYS_ONLY,
      recurringHolidays: [], blockedDates: [],
      specialWorkingDays: [{ date: '2026-06-06' }],
    });
    const otherSaturday = result.days.find(d => d.date === '2026-06-13');
    expect(otherSaturday?.isOpen).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Combined / layered scenarios
// ─────────────────────────────────────────────────────────────────

describe('resolveCalendarMonth — layered combinations', () => {
  test('full realistic salon schedule', () => {
    const result = resolveCalendarMonth({
      year: 2026, month: 6,
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], // closed Sundays
      recurringHolidays: [{ name: 'Mid-month maintenance', type: 'monthly', value: '1' }],
      blockedDates: [{ date: '2026-06-17', reason: 'Owner on leave' }],
      specialWorkingDays: [{ date: '2026-06-07' }], // open this one Sunday
    });

    // June 1 = Monday, closed due to monthly holiday despite being a working day
    expect(result.days.find(d => d.date === '2026-06-01')?.isOpen).toBe(false);

    // June 7 = Sunday, normally closed, but special override opens it
    expect(result.days.find(d => d.date === '2026-06-07')?.isOpen).toBe(true);

    // June 14 = Sunday, no override, stays closed
    expect(result.days.find(d => d.date === '2026-06-14')?.isOpen).toBe(false);

    // June 17 = Wednesday, normally open, blocked explicitly
    expect(result.days.find(d => d.date === '2026-06-17')?.isOpen).toBe(false);

    // June 18 = Thursday, normal working day, unaffected
    expect(result.days.find(d => d.date === '2026-06-18')?.isOpen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// isDateOpen — single-date quick check
// ─────────────────────────────────────────────────────────────────

describe('isDateOpen', () => {
  test('returns true for a normal working day', () => {
    // 2026-06-01 is a Monday
    expect(isDateOpen('2026-06-01', WEEKDAYS_ONLY, [], [], [])).toBe(true);
  });

  test('returns false for a weekend when weekdays-only', () => {
    // 2026-06-06 is a Saturday
    expect(isDateOpen('2026-06-06', WEEKDAYS_ONLY, [], [], [])).toBe(false);
  });

  test('returns false for blocked date', () => {
    expect(isDateOpen(
      '2026-06-01', WEEKDAYS_ONLY,
      [{ date: '2026-06-01' }], [], []
    )).toBe(false);
  });

  test('returns false for recurring weekly holiday', () => {
    expect(isDateOpen(
      '2026-06-07', // Sunday
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      [],
      [{ type: 'weekly', value: 'Sunday' }],
      []
    )).toBe(false);
  });

  test('returns false for recurring monthly holiday', () => {
    expect(isDateOpen(
      '2026-06-15', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      [],
      [{ type: 'monthly', value: '15' }],
      []
    )).toBe(false);
  });

  test('special working day overrides blocked date', () => {
    expect(isDateOpen(
      '2026-06-01', WEEKDAYS_ONLY,
      [{ date: '2026-06-01' }],
      [],
      [{ date: '2026-06-01' }]
    )).toBe(true);
  });

  test('special working day overrides weekend closure', () => {
    expect(isDateOpen(
      '2026-06-06', WEEKDAYS_ONLY, // Saturday, normally closed
      [], [],
      [{ date: '2026-06-06' }]
    )).toBe(true);
  });
});
