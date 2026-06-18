// src/lib/booking/calendarEngine.ts
//
// Pure calendar resolution logic — no DB calls, no side effects.
// Given a month + all holiday data, returns the open/closed status
// for every day in that month.
//
// Resolution order (later rules override earlier ones):
//   1. Start: day is open if its weekday is in daysOpen, else closed
//   2. Apply recurring weekly holidays  → closed
//   3. Apply recurring monthly holidays → closed
//   4. Apply blocked dates              → closed (highest priority closure)
//   5. Apply special working days       → FORCE open (overrides everything above)
//
// This same engine will be reused by the Phase 3C slot generator to
// decide which dates can even be considered before generating time slots.

import type {
  CalendarDay, CalendarMonthView, DayOfWeek,
  BlockedDate, RecurringHoliday, SpecialWorkingDay,
} from '@/types';

const DAY_NAMES: DayOfWeek[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export interface CalendarEngineInput {
  year:               number;
  month:              number; // 1-indexed (1 = January)
  daysOpen:           DayOfWeek[];
  blockedDates:        Pick<BlockedDate, 'date' | 'reason'>[];
  recurringHolidays:   Pick<RecurringHoliday, 'name' | 'type' | 'value'>[];
  specialWorkingDays:  Pick<SpecialWorkingDay, 'date'>[];
}

/**
 * Format a Date as "YYYY-MM-DD" using LOCAL date parts (not UTC) —
 * avoids the classic timezone-shift-by-one-day bug.
 */
function formatDateLocal(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number): number {
  // month is 1-indexed; Date(year, month, 0) gives last day of `month`
  return new Date(year, month, 0).getDate();
}

function getWeekday(year: number, month: number, day: number): DayOfWeek {
  // JS Date month is 0-indexed
  const d = new Date(year, month - 1, day);
  return DAY_NAMES[d.getDay()];
}

/**
 * Resolve the full calendar view for a given month.
 */
export function resolveCalendarMonth(input: CalendarEngineInput): CalendarMonthView {
  const { year, month, daysOpen, blockedDates, recurringHolidays, specialWorkingDays } = input;

  const totalDays = daysInMonth(year, month);

  // Build fast-lookup sets/maps
  const blockedMap = new Map(blockedDates.map(b => [b.date, b.reason ?? 'Blocked date']));
  const specialSet = new Set(specialWorkingDays.map(s => s.date));

  const weeklyHolidays  = recurringHolidays.filter(h => h.type === 'weekly');
  const monthlyHolidays = recurringHolidays.filter(h => h.type === 'monthly');

  const weeklyHolidayByDay = new Map(weeklyHolidays.map(h => [h.value, h.name]));
  const monthlyHolidayByDayNum = new Map(monthlyHolidays.map(h => [h.value, h.name]));

  const days: CalendarDay[] = [];

  for (let day = 1; day <= totalDays; day++) {
    const dateStr   = formatDateLocal(year, month, day);
    const weekday    = getWeekday(year, month, day);

    let isOpen: boolean = daysOpen.includes(weekday);
    let reason: string | undefined;
    let source: CalendarDay['source'];

    if (!isOpen) {
      reason = `Not a working day (${weekday})`;
      source = 'not-in-days-open';
    }

    // Step 2: weekly recurring holiday
    if (weeklyHolidayByDay.has(weekday)) {
      isOpen = false;
      reason = `Weekly holiday: ${weeklyHolidayByDay.get(weekday)}`;
      source = 'recurring-weekly';
    }

    // Step 3: monthly recurring holiday (day-of-month match)
    const dayOfMonthStr = String(day);
    if (monthlyHolidayByDayNum.has(dayOfMonthStr)) {
      isOpen = false;
      reason = `Monthly holiday: ${monthlyHolidayByDayNum.get(dayOfMonthStr)}`;
      source = 'recurring-monthly';
    }

    // Step 4: explicit blocked date (highest priority closure)
    if (blockedMap.has(dateStr)) {
      isOpen = false;
      reason = blockedMap.get(dateStr);
      source = 'blocked';
    }

    // Step 5: special working day — overrides EVERYTHING, forces open
    if (specialSet.has(dateStr)) {
      isOpen = true;
      reason = 'Special working day';
      source = 'special-override';
    }

    days.push({
      date:      dateStr,
      dayOfWeek: weekday,
      isOpen,
      ...(reason && { reason }),
      ...(source && { source }),
    });
  }

  return { year, month, days };
}

/**
 * Quick single-date check — used by the slot generator (Phase 3C)
 * to decide whether to even attempt generating slots for a date,
 * without building the whole month view.
 */
export function isDateOpen(
  dateStr: string, // "YYYY-MM-DD"
  daysOpen: DayOfWeek[],
  blockedDates: Pick<BlockedDate, 'date'>[],
  recurringHolidays: Pick<RecurringHoliday, 'type' | 'value'>[],
  specialWorkingDays: Pick<SpecialWorkingDay, 'date'>[]
): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekday = getWeekday(y, m, d);

  let isOpen = daysOpen.includes(weekday);

  for (const h of recurringHolidays) {
    if (h.type === 'weekly' && h.value === weekday) isOpen = false;
    if (h.type === 'monthly' && Number(h.value) === d) isOpen = false;
  }

  if (blockedDates.some(b => b.date === dateStr)) isOpen = false;

  // Special working day overrides everything
  if (specialWorkingDays.some(s => s.date === dateStr)) isOpen = true;

  return isOpen;
}
