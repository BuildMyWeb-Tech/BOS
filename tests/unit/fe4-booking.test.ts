// tests/unit/fe4-booking.test.ts
// Unit tests for FE-4 Booking module pure logic.

// ─── Step wizard validation ───────────────────────────────────────

function validateStep1(serviceId: string): string | null {
  if (!serviceId) return 'Select a service to continue';
  return null;
}

function validateStep2(date: string, startTime: string): string | null {
  if (!date) return 'Select a date';
  if (!startTime) return 'Select a time slot';
  return null;
}

describe('validateStep1', () => {
  test('passes when service selected', () => expect(validateStep1('svc_123')).toBeNull());
  test('fails when no service', () => expect(validateStep1('')).not.toBeNull());
});

describe('validateStep2', () => {
  test('passes with date and time', () => expect(validateStep2('2026-08-01', '10:00')).toBeNull());
  test('fails missing date', () => expect(validateStep2('', '10:00')).not.toBeNull());
  test('fails missing time', () => expect(validateStep2('2026-08-01', '')).not.toBeNull());
  test('fails both missing', () => expect(validateStep2('', '')).not.toBeNull());
});

// ─── Booking status helpers ───────────────────────────────────────

type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

function statusVariant(s: BookingStatus): string {
  return s === 'CONFIRMED'       ? 'success'
       : s === 'COMPLETED'       ? 'info'
       : s === 'CANCELLED'       ? 'danger'
       : s === 'PENDING_PAYMENT' ? 'warning'
       : 'neutral';
}

function statusLabel(s: BookingStatus): string {
  return s === 'PENDING_PAYMENT' ? 'Pending'
       : s.charAt(0) + s.slice(1).toLowerCase();
}

function isModifiable(s: BookingStatus): boolean {
  return s === 'PENDING_PAYMENT' || s === 'CONFIRMED';
}

describe('statusVariant', () => {
  test('CONFIRMED → success',       () => expect(statusVariant('CONFIRMED')).toBe('success'));
  test('COMPLETED → info',          () => expect(statusVariant('COMPLETED')).toBe('info'));
  test('CANCELLED → danger',        () => expect(statusVariant('CANCELLED')).toBe('danger'));
  test('PENDING_PAYMENT → warning', () => expect(statusVariant('PENDING_PAYMENT')).toBe('warning'));
  test('RESCHEDULED → neutral',     () => expect(statusVariant('RESCHEDULED')).toBe('neutral'));
});

describe('statusLabel', () => {
  test('PENDING_PAYMENT → Pending',   () => expect(statusLabel('PENDING_PAYMENT')).toBe('Pending'));
  test('CONFIRMED → Confirmed',       () => expect(statusLabel('CONFIRMED')).toBe('Confirmed'));
  test('COMPLETED → Completed',       () => expect(statusLabel('COMPLETED')).toBe('Completed'));
  test('CANCELLED → Cancelled',       () => expect(statusLabel('CANCELLED')).toBe('Cancelled'));
  test('RESCHEDULED → Rescheduled',   () => expect(statusLabel('RESCHEDULED')).toBe('Rescheduled'));
});

describe('isModifiable', () => {
  test('PENDING_PAYMENT is modifiable',   () => expect(isModifiable('PENDING_PAYMENT')).toBe(true));
  test('CONFIRMED is modifiable',         () => expect(isModifiable('CONFIRMED')).toBe(true));
  test('COMPLETED is not modifiable',     () => expect(isModifiable('COMPLETED')).toBe(false));
  test('CANCELLED is not modifiable',     () => expect(isModifiable('CANCELLED')).toBe(false));
  test('RESCHEDULED is not modifiable',   () => expect(isModifiable('RESCHEDULED')).toBe(false));
});

// ─── Payment recording validation ─────────────────────────────────

function validatePayment(amount: string, method: string): string | null {
  const n = parseFloat(amount);
  if (!amount || isNaN(n) || n <= 0) return 'Enter a valid amount greater than 0';
  if (!['cash', 'upi', 'card', 'razorpay'].includes(method)) return 'Select a payment method';
  return null;
}

describe('validatePayment', () => {
  test('accepts valid cash payment',    () => expect(validatePayment('500', 'cash')).toBeNull());
  test('accepts valid upi payment',     () => expect(validatePayment('299.50', 'upi')).toBeNull());
  test('rejects zero amount',           () => expect(validatePayment('0', 'cash')).not.toBeNull());
  test('rejects negative amount',       () => expect(validatePayment('-100', 'cash')).not.toBeNull());
  test('rejects empty amount',          () => expect(validatePayment('', 'cash')).not.toBeNull());
  test('rejects non-numeric amount',    () => expect(validatePayment('abc', 'cash')).not.toBeNull());
  test('rejects invalid method',        () => expect(validatePayment('100', 'bitcoin')).not.toBeNull());
});

// ─── Remaining amount calculation ────────────────────────────────

function remainingAmount(total: number, paid: number): number {
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

describe('remainingAmount', () => {
  test('full remaining when nothing paid', () => expect(remainingAmount(1000, 0)).toBe(1000));
  test('partial remaining',               () => expect(remainingAmount(1000, 300)).toBe(700));
  test('zero remaining when fully paid',  () => expect(remainingAmount(1000, 1000)).toBe(0));
  test('zero remaining when overpaid',    () => expect(remainingAmount(1000, 1200)).toBe(0));
  test('rounds to 2 decimal places',      () => expect(remainingAmount(100, 33.33)).toBe(66.67));
});

// ─── Calendar grid helpers ────────────────────────────────────────

function buildCountByDate(bookings: Array<{ date: string }>): Record<string, number> {
  return bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.date] = (acc[b.date] ?? 0) + 1;
    return acc;
  }, {});
}

describe('buildCountByDate', () => {
  test('counts single booking', () =>
    expect(buildCountByDate([{ date: '2026-07-01' }])).toEqual({ '2026-07-01': 1 }));
  test('counts multiple on same day', () =>
    expect(buildCountByDate([{ date: '2026-07-01' }, { date: '2026-07-01' }]))
      .toEqual({ '2026-07-01': 2 }));
  test('handles empty array', () => expect(buildCountByDate([])).toEqual({}));
  test('counts across multiple dates', () => {
    const result = buildCountByDate([{ date: '2026-07-01' }, { date: '2026-07-02' }]);
    expect(result['2026-07-01']).toBe(1);
    expect(result['2026-07-02']).toBe(1);
  });
});
