// tests/unit/slotEngine.test.ts
//
// Unit tests for src/lib/booking/slotEngine.ts
//
// generateDaySlots is pure — tested directly with no mocks.
// getAvailableSlots / isSlotAvailable are DB-aware — tested via a mocked
// prisma client so we can verify the filtering logic (leave dates,
// booking overlap, cutoff window) without a real database.

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    slotConfig:         { findUnique: jest.fn() },
    service:            { findFirst:  jest.fn() },
    blockedDate:        { findMany:   jest.fn() },
    recurringHoliday:   { findMany:   jest.fn() },
    specialWorkingDay:  { findMany:   jest.fn() },
    staff:              { findFirst:  jest.fn() },
    booking:            { findMany:   jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { generateDaySlots, getAvailableSlots, isSlotAvailable } from '@/lib/booking/slotEngine';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─────────────────────────────────────────────────────────────────
// generateDaySlots — pure function, no mocks needed
// ─────────────────────────────────────────────────────────────────

describe('generateDaySlots — basic grid generation', () => {
  test('generates correct number of 30-min slots for 9:00-17:00, 30-min service', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: false, serviceDuration: 30,
    });
    expect(slots).toHaveLength(16);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30', available: true });
    expect(slots[15]).toEqual({ startTime: '16:30', endTime: '17:00', available: true });
  });

  test('does not generate a slot that would run past closing time', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: false, serviceDuration: 45,
    });
    const last = slots[slots.length - 1];
    const [h, m] = last.endTime.split(':').map(Number);
    expect(h * 60 + m).toBeLessThanOrEqual(17 * 60);
  });

  test('service duration longer than slotDuration spans multiple grid steps', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '12:00', slotDuration: 30,
      breakEnabled: false, serviceDuration: 90,
    });
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '10:30', available: true });
    expect(slots[1]).toEqual({ startTime: '09:30', endTime: '11:00', available: true });
  });

  test('returns empty array if serviceDuration exceeds the whole working window', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '10:00', slotDuration: 30,
      breakEnabled: false, serviceDuration: 120,
    });
    expect(slots).toHaveLength(0);
  });

  test('exact-fit: serviceDuration equals full window produces exactly one slot', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '10:00', slotDuration: 30,
      breakEnabled: false, serviceDuration: 60,
    });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ startTime: '09:00', endTime: '10:00', available: true });
  });
});

describe('generateDaySlots — break time exclusion', () => {
  test('excludes slots that overlap the break window', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: true, breakStartTime: '13:00', breakEndTime: '14:00',
      serviceDuration: 30,
    });
    const overlapsBreak = slots.some(s => s.startTime >= '13:00' && s.startTime < '14:00');
    expect(overlapsBreak).toBe(false);
  });

  test('slot ending exactly at break start is allowed', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: true, breakStartTime: '13:00', breakEndTime: '14:00',
      serviceDuration: 30,
    });
    expect(slots.some(s => s.startTime === '12:30' && s.endTime === '13:00')).toBe(true);
  });

  test('slot starting exactly at break end is allowed', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: true, breakStartTime: '13:00', breakEndTime: '14:00',
      serviceDuration: 30,
    });
    expect(slots.some(s => s.startTime === '14:00')).toBe(true);
  });

  test('a long service that would straddle the break is excluded', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: true, breakStartTime: '13:00', breakEndTime: '14:00',
      serviceDuration: 90,
    });
    expect(slots.some(s => s.startTime === '12:30')).toBe(false);
  });

  test('break disabled means no exclusion even with break times set', () => {
    const slots = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: false, breakStartTime: '13:00', breakEndTime: '14:00',
      serviceDuration: 30,
    });
    expect(slots.some(s => s.startTime === '13:00')).toBe(true);
  });
});

describe('generateDaySlots — various slot durations', () => {
  test('15-minute grid produces 4x slots vs 60-minute grid for same window', () => {
    const fineGrid = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '10:00', slotDuration: 15,
      breakEnabled: false, serviceDuration: 15,
    });
    const coarseGrid = generateDaySlots({
      slotStartTime: '09:00', slotEndTime: '10:00', slotDuration: 60,
      breakEnabled: false, serviceDuration: 60,
    });
    expect(fineGrid).toHaveLength(4);
    expect(coarseGrid).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// getAvailableSlots — DB-aware, mocked prisma
// ─────────────────────────────────────────────────────────────────

function mockBaseData(overrides: Partial<{
  slotConfig: any; service: any; blockedDates: any[]; recurringHolidays: any[];
  specialWorkingDays: any[]; staff: any; bookings: any[];
}> = {}) {
  (mockPrisma.slotConfig.findUnique as jest.Mock).mockResolvedValue(
    overrides.slotConfig ?? {
      slotStartTime: '09:00', slotEndTime: '17:00', slotDuration: 30,
      breakEnabled: false, breakStartTime: null, breakEndTime: null,
      daysOpen: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      minBookingHoursBefore: 0,
    }
  );
  (mockPrisma.service.findFirst as jest.Mock).mockResolvedValue(
    'service' in overrides ? overrides.service : { id: 'svc1', duration: 30, isActive: true }
  );
  (mockPrisma.blockedDate.findMany as jest.Mock).mockResolvedValue(overrides.blockedDates ?? []);
  (mockPrisma.recurringHoliday.findMany as jest.Mock).mockResolvedValue(overrides.recurringHolidays ?? []);
  (mockPrisma.specialWorkingDay.findMany as jest.Mock).mockResolvedValue(overrides.specialWorkingDays ?? []);
  (mockPrisma.staff.findFirst as jest.Mock).mockResolvedValue(overrides.staff ?? null);
  (mockPrisma.booking.findMany as jest.Mock).mockResolvedValue(overrides.bookings ?? []);
}

describe('getAvailableSlots — service / closure checks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns isOpen:false with reason if service not found', async () => {
    mockBaseData({ service: null });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'bad-svc',
    });
    expect(result.isOpen).toBe(false);
    expect(result.closedReason).toMatch(/Service not found/);
    expect(result.slots).toHaveLength(0);
  });

  test('returns isOpen:false if the date is a closed day (weekend, weekday-only schedule)', async () => {
    mockBaseData();
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-20', serviceId: 'svc1', // Saturday
    });
    expect(result.isOpen).toBe(false);
    expect(result.slots).toHaveLength(0);
  });

  test('returns isOpen:true with slots for a normal open weekday', async () => {
    mockBaseData();
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1', // Monday
    });
    expect(result.isOpen).toBe(true);
    expect(result.availableCount).toBeGreaterThan(0);
  });
});

describe('getAvailableSlots — staff leave and inactive checks', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns no slots if requested staff is on leave that day', async () => {
    mockBaseData({ staff: { leaveDates: ['2026-06-22'], isActive: true } });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1', staffId: 'staff1',
    });
    expect(result.isOpen).toBe(true);
    expect(result.closedReason).toMatch(/on leave/);
    expect(result.slots).toHaveLength(0);
  });

  test('returns no slots if requested staff is inactive', async () => {
    mockBaseData({ staff: { leaveDates: [], isActive: false } });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1', staffId: 'staff1',
    });
    expect(result.closedReason).toMatch(/inactive/);
    expect(result.slots).toHaveLength(0);
  });

  test('returns slots normally when staff is active and not on leave', async () => {
    mockBaseData({ staff: { leaveDates: ['2026-06-25'], isActive: true } });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1', staffId: 'staff1',
    });
    expect(result.availableCount).toBeGreaterThan(0);
  });
});

describe('getAvailableSlots — booking overlap exclusion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('excludes a slot that exactly matches an existing booking', async () => {
    mockBaseData({ bookings: [{ startTime: '10:00', endTime: '10:30', staffId: null }] });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1',
    });
    expect(result.slots.some(s => s.startTime === '10:00')).toBe(false);
  });

  test('excludes slots that partially overlap an existing longer booking', async () => {
    mockBaseData({
      service: { id: 'svc1', duration: 30, isActive: true },
      bookings: [{ startTime: '10:00', endTime: '11:00', staffId: null }],
    });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1',
    });
    expect(result.slots.some(s => s.startTime === '09:30')).toBe(true);
    expect(result.slots.some(s => s.startTime === '10:30')).toBe(false);
    expect(result.slots.some(s => s.startTime === '11:00')).toBe(true);
  });

  test('does not exclude slots on days with no bookings', async () => {
    mockBaseData({ bookings: [] });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1',
    });
    expect(result.availableCount).toBeGreaterThan(0);
  });
});

describe('getAvailableSlots — calendar engine integration (holidays)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('blocked date results in isOpen:false even on a normally open weekday', async () => {
    mockBaseData({ blockedDates: [{ date: '2026-06-22' }] });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1',
    });
    expect(result.isOpen).toBe(false);
  });

  test('special working day forces isOpen:true on a normally closed weekend', async () => {
    mockBaseData({ specialWorkingDays: [{ date: '2026-06-20' }] });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-20', serviceId: 'svc1', // Saturday
    });
    expect(result.isOpen).toBe(true);
    expect(result.availableCount).toBeGreaterThan(0);
  });

  test('recurring weekly holiday closes that weekday', async () => {
    mockBaseData({ recurringHolidays: [{ type: 'weekly', value: 'Monday' }] });
    const result = await getAvailableSlots({
      tenantId: 't1', date: '2026-06-22', serviceId: 'svc1', // Monday
    });
    expect(result.isOpen).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// isSlotAvailable — single-slot race-condition guard
// ─────────────────────────────────────────────────────────────────

describe('isSlotAvailable', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns available:true for a free slot', async () => {
    mockBaseData();
    const result = await isSlotAvailable({
      tenantId: 't1', date: '2026-06-22', startTime: '10:00', serviceId: 'svc1',
    });
    expect(result.available).toBe(true);
  });

  test('returns available:false if the slot is already booked', async () => {
    mockBaseData({ bookings: [{ startTime: '10:00', endTime: '10:30', staffId: null }] });
    const result = await isSlotAvailable({
      tenantId: 't1', date: '2026-06-22', startTime: '10:00', serviceId: 'svc1',
    });
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/no longer available/);
  });

  test('returns available:false with closedReason if the date is closed', async () => {
    mockBaseData({ blockedDates: [{ date: '2026-06-22' }] });
    const result = await isSlotAvailable({
      tenantId: 't1', date: '2026-06-22', startTime: '10:00', serviceId: 'svc1',
    });
    expect(result.available).toBe(false);
    expect(result.reason).toBeDefined();
  });

  test('returns available:false for a startTime that does not exist in the grid', async () => {
    mockBaseData();
    const result = await isSlotAvailable({
      tenantId: 't1', date: '2026-06-22', startTime: '10:07', serviceId: 'svc1',
    });
    expect(result.available).toBe(false);
  });
});
