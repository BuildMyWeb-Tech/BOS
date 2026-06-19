// src/lib/booking/slotEngine.ts
//
// Slot Generation Engine.
//
// Two layers:
//   1. generateDaySlots()  — PURE function. Given working hours + break +
//      slot duration + service duration, produces the raw grid of candidate
//      time windows for one day. No DB, no booking awareness.
//   2. getAvailableSlots() / isSlotAvailable() — DB-AWARE. Calls
//      generateDaySlots() then filters out: staff leave days, existing
//      overlapping bookings, slots inside the minBookingHoursBefore buffer,
//      and days closed per the calendar engine.
//
// Time overlap convention: a slot [start, end) overlaps an existing booking
// [bStart, bEnd) iff start < bEnd AND end > bStart. This correctly handles
// services longer than the configured slotDuration (e.g. a 90-minute
// service spanning three 30-minute grid slots).

import prisma from '@/lib/prisma';
import { isDateOpen } from '@/lib/booking/calendarEngine';
import type { AvailableSlot, DayOfWeek, SlotConfig as SlotConfigType } from '@/types';

// ─── Time helpers (string "HH:MM" <-> minutes-since-midnight) ────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Layer 1: Pure grid generator ─────────────────────────────────

export interface GenerateDaySlotsInput {
  slotStartTime:  string; // "HH:MM"
  slotEndTime:    string;
  slotDuration:   number; // grid step, minutes
  breakEnabled:   boolean;
  breakStartTime?: string | null;
  breakEndTime?:   string | null;
  serviceDuration: number; // the actual service length — may exceed slotDuration
}

/**
 * Generate the raw candidate time windows for a single day, ignoring
 * bookings/leave entirely. A "slot" here is a [startTime, endTime) window
 * exactly serviceDuration long, anchored on slotDuration-spaced grid points,
 * that does not cross the break window and does not run past closing time.
 */
export function generateDaySlots(input: GenerateDaySlotsInput): AvailableSlot[] {
  const {
    slotStartTime, slotEndTime, slotDuration,
    breakEnabled, breakStartTime, breakEndTime,
    serviceDuration,
  } = input;

  const dayStart = timeToMinutes(slotStartTime);
  const dayEnd   = timeToMinutes(slotEndTime);

  const breakStart = breakEnabled && breakStartTime ? timeToMinutes(breakStartTime) : null;
  const breakEnd    = breakEnabled && breakEndTime   ? timeToMinutes(breakEndTime)   : null;

  const slots: AvailableSlot[] = [];

  for (let cursor = dayStart; cursor + serviceDuration <= dayEnd; cursor += slotDuration) {
    const slotEndMin = cursor + serviceDuration;

    // Skip if this candidate window overlaps the break period
    if (breakStart !== null && breakEnd !== null) {
      const overlapsBreak = cursor < breakEnd && slotEndMin > breakStart;
      if (overlapsBreak) continue;
    }

    slots.push({
      startTime: minutesToTime(cursor),
      endTime:   minutesToTime(slotEndMin),
      available: true,
    });
  }

  return slots;
}

// ─── Layer 2: DB-aware availability ───────────────────────────────

export interface GetAvailableSlotsParams {
  tenantId:  string;
  date:      string; // "YYYY-MM-DD"
  serviceId: string;
  staffId?:  string | null;
}

export interface GetAvailableSlotsResult {
  date:          string;
  isOpen:        boolean;
  closedReason?: string;
  slots:         AvailableSlot[];
  availableCount: number;
}

/**
 * Full DB-aware availability computation for one date.
 * Steps:
 *   1. Load SlotConfig, Service (duration), holiday data, staff leave dates
 *   2. Check isDateOpen() — bail early with isOpen:false if closed
 *   3. generateDaySlots() for the raw grid
 *   4. Filter out slots if staffId given and staff is on leave that date
 *   5. Filter out slots overlapping existing bookings (CONFIRMED or PENDING_PAYMENT)
 *   6. Filter out slots starting sooner than minBookingHoursBefore from now
 *      (only matters for "today" or near-term dates)
 */
export async function getAvailableSlots(
  params: GetAvailableSlotsParams
): Promise<GetAvailableSlotsResult> {
  const { tenantId, date, serviceId, staffId } = params;

  // 1. Load all required data in parallel
  const [slotConfig, service, blockedDates, recurringHolidays, specialWorkingDays, staff] =
    await Promise.all([
      prisma.slotConfig.findUnique({ where: { tenantId } }),
      prisma.service.findFirst({ where: { id: serviceId, tenantId, isActive: true } }),
      prisma.blockedDate.findMany({ where: { tenantId, date }, select: { date: true } }),
      prisma.recurringHoliday.findMany({ where: { tenantId }, select: { type: true, value: true } }),
      prisma.specialWorkingDay.findMany({ where: { tenantId, date }, select: { date: true } }),
      staffId
        ? prisma.staff.findFirst({ where: { id: staffId, tenantId }, select: { leaveDates: true, isActive: true } })
        : Promise.resolve(null),
    ]);

  if (!service) {
    return { date, isOpen: false, closedReason: 'Service not found or inactive', slots: [], availableCount: 0 };
  }

  const daysOpen = (slotConfig?.daysOpen as DayOfWeek[] | undefined) ?? [];

  // 2. Calendar gate
  const open = isDateOpen(date, daysOpen, blockedDates, recurringHolidays, specialWorkingDays);
  if (!open) {
    return { date, isOpen: false, closedReason: 'Business closed on this date', slots: [], availableCount: 0 };
  }

  // Staff on leave that day → no slots at all for this staff member
  if (staffId && staff?.leaveDates.includes(date)) {
    return { date, isOpen: true, closedReason: 'Selected staff is on leave', slots: [], availableCount: 0 };
  }

  if (staffId && staff && !staff.isActive) {
    return { date, isOpen: true, closedReason: 'Selected staff is inactive', slots: [], availableCount: 0 };
  }

  const config: Pick<SlotConfigType, 'slotStartTime' | 'slotEndTime' | 'slotDuration' | 'breakEnabled' | 'breakStartTime' | 'breakEndTime' | 'minBookingHoursBefore'> = {
    slotStartTime:         slotConfig?.slotStartTime         ?? '09:00',
    slotEndTime:           slotConfig?.slotEndTime           ?? '17:00',
    slotDuration:          slotConfig?.slotDuration          ?? 30,
    breakEnabled:          slotConfig?.breakEnabled          ?? false,
    breakStartTime:        slotConfig?.breakStartTime        ?? null,
    breakEndTime:          slotConfig?.breakEndTime          ?? null,
    minBookingHoursBefore: slotConfig?.minBookingHoursBefore ?? 0,
  };

  // 3. Raw grid
  const rawSlots = generateDaySlots({
    slotStartTime:   config.slotStartTime,
    slotEndTime:     config.slotEndTime,
    slotDuration:    config.slotDuration,
    breakEnabled:    config.breakEnabled,
    breakStartTime:  config.breakStartTime,
    breakEndTime:    config.breakEndTime,
    serviceDuration: service.duration,
  });

  // 4. Existing bookings for this date (and staff, if specified) that block the calendar
  const existingBookings = await prisma.booking.findMany({
    where: {
      tenantId,
      date,
      status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
      ...(staffId ? { staffId } : {}),
    },
    select: { startTime: true, endTime: true, staffId: true },
  });

  // 5. minBookingHoursBefore cutoff — only relevant if `date` is within that window from now
  const now = new Date();
  const cutoff = new Date(now.getTime() + config.minBookingHoursBefore * 60 * 60 * 1000);
  const cutoffDateStr = formatLocalDate(cutoff);
  const cutoffMinutes = cutoffDateStr === date ? cutoff.getHours() * 60 + cutoff.getMinutes() : -1;

  const finalSlots = rawSlots.filter(slot => {
    const slotStartMin = timeToMinutes(slot.startTime);
    const slotEndMin    = timeToMinutes(slot.endTime);

    // Cutoff filter — only applies to today (cutoffDateStr === date)
    if (cutoffDateStr === date && slotStartMin < cutoffMinutes) {
      return false;
    }
    // If the cutoff pushes past this date entirely (date < cutoffDateStr), block everything
    if (date < cutoffDateStr) {
      return false;
    }

    // Overlap filter against existing bookings
    const overlaps = existingBookings.some(b => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd   = timeToMinutes(b.endTime);
      return slotStartMin < bEnd && slotEndMin > bStart;
    });

    return !overlaps;
  });

  return {
    date,
    isOpen: true,
    slots: finalSlots,
    availableCount: finalSlots.length,
  };
}

/**
 * Single-slot validation — called immediately before booking creation
 * (Phase 4) to guard against race conditions between availability check
 * and actual booking insert. Re-runs the same checks for one specific slot.
 */
export async function isSlotAvailable(params: {
  tenantId:   string;
  date:       string;
  startTime:  string;
  serviceId:  string;
  staffId?:   string | null;
}): Promise<{ available: boolean; reason?: string }> {
  const { tenantId, date, startTime, serviceId, staffId } = params;

  const result = await getAvailableSlots({ tenantId, date, serviceId, staffId });

  if (!result.isOpen) {
    return { available: false, reason: result.closedReason ?? 'Date is closed' };
  }

  const match = result.slots.find(s => s.startTime === startTime);

  if (!match) {
    return { available: false, reason: 'Slot is no longer available' };
  }

  return { available: true };
}

// ─── Internal helper ───────────────────────────────────────────────

function formatLocalDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
