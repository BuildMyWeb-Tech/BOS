// tests/unit/bookingMath.test.ts
// Unit tests for src/lib/booking/bookingMath.ts — pure functions, no mocks.

import { calculateRequiredAdvance, applyPayment, canModifyBooking } from '@/lib/booking/bookingMath';

// ─────────────────────────────────────────────────────────────────
// calculateRequiredAdvance
// ─────────────────────────────────────────────────────────────────

describe('calculateRequiredAdvance', () => {
  test('returns full amount when advance payment not required', () => {
    expect(calculateRequiredAdvance(1000, false, 50)).toBe(1000);
  });

  test('returns full amount when not required, regardless of percent value', () => {
    expect(calculateRequiredAdvance(500, false, 10)).toBe(500);
  });

  test('calculates 100% advance correctly', () => {
    expect(calculateRequiredAdvance(1000, true, 100)).toBe(1000);
  });

  test('calculates 50% advance correctly', () => {
    expect(calculateRequiredAdvance(1000, true, 50)).toBe(500);
  });

  test('calculates 25% advance correctly', () => {
    expect(calculateRequiredAdvance(1000, true, 25)).toBe(250);
  });

  test('calculates 10% advance correctly', () => {
    expect(calculateRequiredAdvance(1000, true, 10)).toBe(100);
  });

  test('rounds to 2 decimal places for non-round totals', () => {
    // 333 * 0.25 = 83.25 exactly
    expect(calculateRequiredAdvance(333, true, 25)).toBe(83.25);
  });

  test('handles fractional totals that would otherwise drift', () => {
    // 99.99 * 0.20 = 19.998 -> rounds to 20.00
    expect(calculateRequiredAdvance(99.99, true, 20)).toBe(20);
  });

  test('returns 0 for a free service (totalAmount 0)', () => {
    expect(calculateRequiredAdvance(0, true, 50)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// applyPayment
// ─────────────────────────────────────────────────────────────────

describe('applyPayment — basic accumulation', () => {
  test('first payment moves paidAmount up from zero', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 500,
    });
    expect(result.newPaidAmount).toBe(500);
    expect(result.newRemainingAmount).toBe(500);
  });

  test('accumulates across multiple payments', () => {
    const result = applyPayment({
      currentPaidAmount: 300, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 200,
    });
    expect(result.newPaidAmount).toBe(500);
    expect(result.newRemainingAmount).toBe(500);
  });

  test('full payment in one shot zeroes out remaining', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 1000, paymentAmount: 1000,
    });
    expect(result.newRemainingAmount).toBe(0);
  });
});

describe('applyPayment — status transitions', () => {
  test('partial payment below required advance stays PENDING_PAYMENT', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 300,
    });
    expect(result.newStatus).toBe('PENDING_PAYMENT');
  });

  test('payment meeting exactly the required advance moves to CONFIRMED', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 500,
    });
    expect(result.newStatus).toBe('CONFIRMED');
  });

  test('payment exceeding required advance also confirms', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 800,
    });
    expect(result.newStatus).toBe('CONFIRMED');
  });

  test('cumulative payments crossing the threshold confirm on the crossing payment', () => {
    const first = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 400,
    });
    expect(first.newStatus).toBe('PENDING_PAYMENT');

    const second = applyPayment({
      currentPaidAmount: first.newPaidAmount, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 200,
    });
    expect(second.newStatus).toBe('CONFIRMED');
    expect(second.newPaidAmount).toBe(600);
  });

  test('when requiredAdvance equals totalAmount (full payment mode), partial payment does not confirm', () => {
    const result = applyPayment({
      currentPaidAmount: 0, totalAmount: 1000, requiredAdvance: 1000, paymentAmount: 999,
    });
    expect(result.newStatus).toBe('PENDING_PAYMENT');
  });
});

describe('applyPayment — overpayment safety', () => {
  test('payment that would exceed totalAmount is capped at totalAmount', () => {
    const result = applyPayment({
      currentPaidAmount: 800, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 500,
    });
    // 800 + 500 = 1300, but capped at 1000
    expect(result.newPaidAmount).toBe(1000);
    expect(result.newRemainingAmount).toBe(0);
  });

  test('capped overpayment still results in CONFIRMED status', () => {
    const result = applyPayment({
      currentPaidAmount: 800, totalAmount: 1000, requiredAdvance: 500, paymentAmount: 500,
    });
    expect(result.newStatus).toBe('CONFIRMED');
  });
});

describe('applyPayment — floating point safety', () => {
  test('repeated small payments do not drift due to float imprecision', () => {
    let paid = 0;
    const total = 100;
    const required = 100;
    for (let i = 0; i < 10; i++) {
      const r = applyPayment({ currentPaidAmount: paid, totalAmount: total, requiredAdvance: required, paymentAmount: 10 });
      paid = r.newPaidAmount;
    }
    expect(paid).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────
// canModifyBooking
// ─────────────────────────────────────────────────────────────────

describe('canModifyBooking — reschedule-enabled gate', () => {
  test('blocks reschedule entirely when allowRescheduling is false', () => {
    const result = canModifyBooking({
      date: '2026-07-01', startTime: '10:00',
      now: new Date('2026-06-01T00:00:00'),
      rescheduleHoursBefore: 24,
      allowRescheduling: false,
      isReschedule: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/not enabled/);
  });

  test('cancel is unaffected by allowRescheduling flag', () => {
    const result = canModifyBooking({
      date: '2026-07-01', startTime: '10:00',
      now: new Date('2026-06-01T00:00:00'),
      rescheduleHoursBefore: 24,
      allowRescheduling: false,
      isReschedule: false,
    });
    expect(result.allowed).toBe(true);
  });
});

describe('canModifyBooking — time window', () => {
  test('allows modification well before the window cutoff', () => {
    const result = canModifyBooking({
      date: '2026-07-10', startTime: '10:00',
      now: new Date('2026-07-01T00:00:00'),
      rescheduleHoursBefore: 24,
      allowRescheduling: true,
      isReschedule: false,
    });
    expect(result.allowed).toBe(true);
  });

  test('blocks modification inside the cutoff window', () => {
    const result = canModifyBooking({
      date: '2026-07-01', startTime: '10:00',
      now: new Date('2026-06-30T23:00:00'), // 1 hour before, window is 24h
      rescheduleHoursBefore: 24,
      allowRescheduling: true,
      isReschedule: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/24 hour/);
  });

  test('allows modification exactly at the boundary', () => {
    const result = canModifyBooking({
      date: '2026-07-02', startTime: '10:00',
      now: new Date('2026-07-01T10:00:00'), // exactly 24h before
      rescheduleHoursBefore: 24,
      allowRescheduling: true,
      isReschedule: false,
    });
    expect(result.allowed).toBe(true);
  });

  test('blocks modification for a booking already in the past', () => {
    const result = canModifyBooking({
      date: '2026-06-01', startTime: '10:00',
      now: new Date('2026-06-02T00:00:00'), // booking already happened
      rescheduleHoursBefore: 24,
      allowRescheduling: true,
      isReschedule: false,
    });
    expect(result.allowed).toBe(false);
  });

  test('respects a zero-hour window (modify up to the last minute)', () => {
    const result = canModifyBooking({
      date: '2026-07-01', startTime: '10:00',
      now: new Date('2026-07-01T09:59:00'),
      rescheduleHoursBefore: 0,
      allowRescheduling: true,
      isReschedule: false,
    });
    expect(result.allowed).toBe(true);
  });
});
