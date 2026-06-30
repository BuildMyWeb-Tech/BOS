// tests/unit/fe3-settings.test.ts
// Unit tests for FE-3 settings & holiday management pure logic.

// ─── Tax calculation helpers ──────────────────────────────────────

function calcTaxAmount(subtotal: number, taxType: 'SINGLE' | 'SPLIT', taxPercent: number, cgst: number, sgst: number): number {
  if (taxType === 'SINGLE') return Math.round(subtotal * (taxPercent / 100) * 100) / 100;
  return Math.round(subtotal * ((cgst + sgst) / 100) * 100) / 100;
}

describe('calcTaxAmount', () => {
  test('SINGLE: calculates flat tax', () => expect(calcTaxAmount(1000, 'SINGLE', 18, 0, 0)).toBe(180));
  test('SPLIT: sums cgst + sgst', () => expect(calcTaxAmount(1000, 'SPLIT', 0, 9, 9)).toBe(180));
  test('SINGLE: zero tax', () => expect(calcTaxAmount(1000, 'SINGLE', 0, 0, 0)).toBe(0));
  test('SPLIT: asymmetric rates', () => expect(calcTaxAmount(1000, 'SPLIT', 0, 6, 6)).toBe(120));
  test('rounds to 2 decimal places', () => expect(calcTaxAmount(100, 'SINGLE', 18.5, 0, 0)).toBe(18.5));
});

// ─── Slot config validation ──────────────────────────────────────

function validateSlotConfig(cfg: {
  startTime: string; endTime: string; daysOpen: string[];
  breakEnabled: boolean; breakStart?: string; breakEnd?: string;
}): string | null {
  if (cfg.daysOpen.length === 0) return 'Select at least one working day';
  if (cfg.endTime <= cfg.startTime) return 'End time must be after start time';
  if (cfg.breakEnabled && (!cfg.breakStart || !cfg.breakEnd)) return 'Set break start and end times';
  if (cfg.breakEnabled && cfg.breakStart && cfg.breakEnd && cfg.breakEnd <= cfg.breakStart)
    return 'Break end must be after break start';
  return null;
}

describe('validateSlotConfig', () => {
  const valid = { startTime: '09:00', endTime: '17:00', daysOpen: ['Monday'], breakEnabled: false };
  test('passes valid config', () => expect(validateSlotConfig(valid)).toBeNull());
  test('rejects empty daysOpen', () => expect(validateSlotConfig({ ...valid, daysOpen: [] })).not.toBeNull());
  test('rejects end <= start', () => expect(validateSlotConfig({ ...valid, endTime: '08:00' })).not.toBeNull());
  test('rejects equal start and end', () => expect(validateSlotConfig({ ...valid, endTime: '09:00' })).not.toBeNull());
  test('rejects break enabled without times', () => expect(validateSlotConfig({ ...valid, breakEnabled: true })).not.toBeNull());
  test('accepts break with valid times', () => expect(validateSlotConfig({
    ...valid, breakEnabled: true, breakStart: '13:00', breakEnd: '14:00',
  })).toBeNull());
  test('rejects break end before break start', () => expect(validateSlotConfig({
    ...valid, breakEnabled: true, breakStart: '14:00', breakEnd: '13:00',
  })).not.toBeNull());
});

// ─── Day-of-week toggle ───────────────────────────────────────────

type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

function toggleDay(current: DayOfWeek[], day: DayOfWeek): DayOfWeek[] {
  return current.includes(day) ? current.filter(d => d !== day) : [...current, day];
}

describe('toggleDay', () => {
  test('adds a day when not present', () => expect(toggleDay(['Monday'], 'Tuesday')).toContain('Tuesday'));
  test('removes a day when present', () => expect(toggleDay(['Monday', 'Tuesday'], 'Monday')).not.toContain('Monday'));
  test('preserves other days', () => expect(toggleDay(['Monday', 'Tuesday'], 'Monday')).toContain('Tuesday'));
  test('handles empty array', () => expect(toggleDay([], 'Monday')).toEqual(['Monday']));
});

// ─── Calendar grid helpers ────────────────────────────────────────

function getFirstDayOffset(year: number, month: number): number {
  // Returns 0=Mon ... 6=Sun (European week start)
  const d = new Date(year, month - 1, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

describe('getFirstDayOffset', () => {
  test('June 2026 starts on Monday (offset 0)', () => expect(getFirstDayOffset(2026, 6)).toBe(0));
  test('July 2026 starts on Wednesday (offset 2)', () => expect(getFirstDayOffset(2026, 7)).toBe(2));
  test('returns 0-6 range', () => {
    for (let m = 1; m <= 12; m++) {
      const offset = getFirstDayOffset(2026, m);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(6);
    }
  });
});

describe('daysInMonth', () => {
  test('June has 30 days', () => expect(daysInMonth(2026, 6)).toBe(30));
  test('February 2026 has 28 days (non-leap)', () => expect(daysInMonth(2026, 2)).toBe(28));
  test('February 2028 has 29 days (leap)', () => expect(daysInMonth(2028, 2)).toBe(29));
  test('December has 31 days', () => expect(daysInMonth(2026, 12)).toBe(31));
});

// ─── Month navigation ─────────────────────────────────────────────

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

describe('prevMonth', () => {
  test('decrements month', () => expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 }));
  test('wraps December to previous year', () => expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 }));
});

describe('nextMonth', () => {
  test('increments month', () => expect(nextMonth(2026, 6)).toEqual({ year: 2026, month: 7 }));
  test('wraps December to next year', () => expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 }));
});

// ─── Blocked date badge color ─────────────────────────────────────

type CalendarSource = 'blocked' | 'recurring-weekly' | 'recurring-monthly' | 'not-in-days-open' | 'special-override';

function dayBgClass(isOpen: boolean, source?: CalendarSource): string {
  if (!isOpen && source === 'blocked') return 'bg-red-100 text-red-700';
  if (!isOpen) return 'bg-gray-100 text-gray-400';
  return 'text-gray-700 hover:bg-indigo-50';
}

describe('dayBgClass', () => {
  test('open day gets hover class', () => expect(dayBgClass(true)).toContain('text-gray-700'));
  test('blocked day gets red class', () => expect(dayBgClass(false, 'blocked')).toContain('bg-red-100'));
  test('recurring closed day gets gray', () => expect(dayBgClass(false, 'recurring-weekly')).toContain('bg-gray-100'));
  test('weekend closed day gets gray', () => expect(dayBgClass(false, 'not-in-days-open')).toContain('bg-gray-100'));
});
