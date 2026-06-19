// tests/unit/booking-lifecycle-validation.test.ts
// Unit tests for Phase 4 booking lifecycle schemas in validation.ts

import {
  createBookingSchema,
  cancelBookingSchema,
  rescheduleBookingSchema,
  recordPaymentSchema,
  updateBookingStatusSchema,
  bookingListQuerySchema,
  validate,
} from '@/lib/validation';

const VALID_CUID = 'clx0a1b2c0000a1b2c3d4e5f6';

// ─── createBookingSchema ────────────────────────────────────────────

describe('createBookingSchema — valid inputs', () => {
  test('accepts minimal valid booking (single service, no staff/resource)', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], date: '2026-07-01', startTime: '10:00',
    }).success).toBe(true);
  });

  test('accepts multiple serviceIds', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID, VALID_CUID], date: '2026-07-01', startTime: '10:00',
    }).success).toBe(true);
  });

  test('accepts with staffId', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], staffId: VALID_CUID, date: '2026-07-01', startTime: '10:00',
    }).success).toBe(true);
  });

  test('accepts with resourceId', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], resourceId: VALID_CUID, date: '2026-07-01', startTime: '10:00',
    }).success).toBe(true);
  });

  test('accepts with notes', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], date: '2026-07-01', startTime: '10:00', notes: 'First time customer',
    }).success).toBe(true);
  });

  test('accepts null staffId and resourceId explicitly', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], staffId: null, resourceId: null, date: '2026-07-01', startTime: '10:00',
    }).success).toBe(true);
  });
});

describe('createBookingSchema — invalid inputs', () => {
  test('rejects empty serviceIds array', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [], date: '2026-07-01', startTime: '10:00',
    }).success).toBe(false);
  });

  test('rejects missing serviceIds', () => {
    expect(createBookingSchema.safeParse({
      date: '2026-07-01', startTime: '10:00',
    }).success).toBe(false);
  });

  test('rejects non-cuid serviceId', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: ['bad-id'], date: '2026-07-01', startTime: '10:00',
    }).success).toBe(false);
  });

  test('rejects invalid date format', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], date: '01-07-2026', startTime: '10:00',
    }).success).toBe(false);
  });

  test('rejects invalid time format', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], date: '2026-07-01', startTime: '10:00am',
    }).success).toBe(false);
  });

  test('rejects notes longer than 500 chars', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], date: '2026-07-01', startTime: '10:00', notes: 'X'.repeat(501),
    }).success).toBe(false);
  });

  test('rejects non-cuid staffId', () => {
    expect(createBookingSchema.safeParse({
      serviceIds: [VALID_CUID], staffId: 'bad', date: '2026-07-01', startTime: '10:00',
    }).success).toBe(false);
  });
});

// ─── cancelBookingSchema ─────────────────────────────────────────────

describe('cancelBookingSchema', () => {
  test('accepts with reason', () => {
    expect(cancelBookingSchema.safeParse({ reason: 'Change of plans' }).success).toBe(true);
  });

  test('accepts without reason (fully optional)', () => {
    expect(cancelBookingSchema.safeParse({}).success).toBe(true);
  });

  test('rejects reason longer than 300 chars', () => {
    expect(cancelBookingSchema.safeParse({ reason: 'X'.repeat(301) }).success).toBe(false);
  });

  test('trims reason', () => {
    const r = cancelBookingSchema.safeParse({ reason: '  Sick  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.reason).toBe('Sick');
  });
});

// ─── rescheduleBookingSchema ─────────────────────────────────────────

describe('rescheduleBookingSchema', () => {
  test('accepts valid date and time', () => {
    expect(rescheduleBookingSchema.safeParse({ date: '2026-07-15', startTime: '14:30' }).success).toBe(true);
  });

  test('rejects missing date', () => {
    expect(rescheduleBookingSchema.safeParse({ startTime: '14:30' }).success).toBe(false);
  });

  test('rejects missing startTime', () => {
    expect(rescheduleBookingSchema.safeParse({ date: '2026-07-15' }).success).toBe(false);
  });

  test('rejects invalid time format', () => {
    expect(rescheduleBookingSchema.safeParse({ date: '2026-07-15', startTime: '2:30 PM' }).success).toBe(false);
  });
});

// ─── recordPaymentSchema ─────────────────────────────────────────────

describe('recordPaymentSchema — non-razorpay methods', () => {
  test('accepts valid cash payment', () => {
    expect(recordPaymentSchema.safeParse({ amount: 500, method: 'cash' }).success).toBe(true);
  });

  test('accepts valid upi payment', () => {
    expect(recordPaymentSchema.safeParse({ amount: 250.50, method: 'upi' }).success).toBe(true);
  });

  test('accepts valid card payment', () => {
    expect(recordPaymentSchema.safeParse({ amount: 1000, method: 'card' }).success).toBe(true);
  });

  test('rejects zero amount', () => {
    expect(recordPaymentSchema.safeParse({ amount: 0, method: 'cash' }).success).toBe(false);
  });

  test('rejects negative amount', () => {
    expect(recordPaymentSchema.safeParse({ amount: -50, method: 'cash' }).success).toBe(false);
  });

  test('rejects invalid method', () => {
    expect(recordPaymentSchema.safeParse({ amount: 500, method: 'cheque' }).success).toBe(false);
  });

  test('rejects missing amount', () => {
    expect(recordPaymentSchema.safeParse({ method: 'cash' }).success).toBe(false);
  });
});

describe('recordPaymentSchema — razorpay method', () => {
  test('accepts razorpay with both order and payment IDs', () => {
    expect(recordPaymentSchema.safeParse({
      amount: 500, method: 'razorpay',
      razorpayOrderId: 'order_abc123', razorpayPaymentId: 'pay_xyz789',
    }).success).toBe(true);
  });

  test('rejects razorpay without razorpayPaymentId', () => {
    expect(recordPaymentSchema.safeParse({
      amount: 500, method: 'razorpay', razorpayOrderId: 'order_abc123',
    }).success).toBe(false);
  });

  test('rejects razorpay without razorpayOrderId', () => {
    expect(recordPaymentSchema.safeParse({
      amount: 500, method: 'razorpay', razorpayPaymentId: 'pay_xyz789',
    }).success).toBe(false);
  });

  test('rejects razorpay with neither ID', () => {
    expect(recordPaymentSchema.safeParse({ amount: 500, method: 'razorpay' }).success).toBe(false);
  });
});

// ─── updateBookingStatusSchema ───────────────────────────────────────

describe('updateBookingStatusSchema', () => {
  test('accepts each valid status', () => {
    for (const status of ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']) {
      expect(updateBookingStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });

  test('rejects invalid status string', () => {
    expect(updateBookingStatusSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(false);
  });

  test('rejects missing status', () => {
    expect(updateBookingStatusSchema.safeParse({}).success).toBe(false);
  });

  test('is case-sensitive', () => {
    expect(updateBookingStatusSchema.safeParse({ status: 'confirmed' }).success).toBe(false);
  });
});

// ─── bookingListQuerySchema ──────────────────────────────────────────

describe('bookingListQuerySchema', () => {
  test('accepts fully empty query (all optional)', () => {
    expect(bookingListQuerySchema.safeParse({}).success).toBe(true);
  });

  test('accepts status filter alone', () => {
    expect(bookingListQuerySchema.safeParse({ status: 'CONFIRMED' }).success).toBe(true);
  });

  test('accepts date range filter', () => {
    expect(bookingListQuerySchema.safeParse({ from: '2026-07-01', to: '2026-07-31' }).success).toBe(true);
  });

  test('accepts staffId filter', () => {
    expect(bookingListQuerySchema.safeParse({ staffId: VALID_CUID }).success).toBe(true);
  });

  test('rejects invalid status value', () => {
    expect(bookingListQuerySchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });

  test('rejects invalid date format in from', () => {
    expect(bookingListQuerySchema.safeParse({ from: 'July 1' }).success).toBe(false);
  });
});

// ─── validate() integration ──────────────────────────────────────────

describe('validate() with booking lifecycle schemas', () => {
  test('returns structured errors for invalid createBooking', () => {
    const result = validate(createBookingSchema, { serviceIds: [], date: 'bad', startTime: 'bad' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('serviceIds');
    expect(result.errors).toHaveProperty('date');
    expect(result.errors).toHaveProperty('startTime');
  });
});
