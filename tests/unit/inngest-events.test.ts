// tests/unit/inngest-events.test.ts
// Unit tests for Inngest event helpers — pure logic only (no Inngest client mock needed).

// ─── fireLowStockCheck guard ─────────────────────────────────────
// The fireLowStockCheck wrapper only sends the event when quantity <= lowStock.
// We test the guard logic in isolation.

function shouldFireLowStock(quantity: number, lowStock: number): boolean {
  return quantity <= lowStock;
}

describe('Low stock event guard', () => {
  test('fires when quantity equals lowStock threshold',   () => expect(shouldFireLowStock(10, 10)).toBe(true));
  test('fires when quantity below threshold',             () => expect(shouldFireLowStock(3, 10)).toBe(true));
  test('fires when quantity is zero (out of stock)',      () => expect(shouldFireLowStock(0, 10)).toBe(true));
  test('does NOT fire when quantity above threshold',     () => expect(shouldFireLowStock(11, 10)).toBe(false));
  test('does NOT fire when threshold is zero and stock > 0', () => expect(shouldFireLowStock(1, 0)).toBe(false));
  test('fires when both are zero',                       () => expect(shouldFireLowStock(0, 0)).toBe(true));
});

// ─── Event name catalogue ────────────────────────────────────────

const EVENT_NAMES = [
  'booking/created',
  'booking/status.changed',
  'inventory/low-stock.check',
  'vendor/approved',
  'vendor/rejected',
  'booking/reminder.trigger',
] as const;

type EventName = typeof EVENT_NAMES[number];

function isValidEventName(name: string): name is EventName {
  return EVENT_NAMES.includes(name as EventName);
}

describe('BOS event name catalogue', () => {
  test('all 6 events are defined', () => expect(EVENT_NAMES).toHaveLength(6));
  test('booking/created is valid',                () => expect(isValidEventName('booking/created')).toBe(true));
  test('booking/status.changed is valid',         () => expect(isValidEventName('booking/status.changed')).toBe(true));
  test('inventory/low-stock.check is valid',      () => expect(isValidEventName('inventory/low-stock.check')).toBe(true));
  test('vendor/approved is valid',                () => expect(isValidEventName('vendor/approved')).toBe(true));
  test('vendor/rejected is valid',                () => expect(isValidEventName('vendor/rejected')).toBe(true));
  test('booking/reminder.trigger is valid',       () => expect(isValidEventName('booking/reminder.trigger')).toBe(true));
  test('arbitrary string is NOT valid',           () => expect(isValidEventName('payment/created')).toBe(false));
  test('empty string is NOT valid',               () => expect(isValidEventName('')).toBe(false));
});

// ─── Event payload shapes ────────────────────────────────────────

interface VendorApprovedData { tenantId:string; tenantName:string; ownerEmail:string; ownerName:string }
interface VendorRejectedData extends VendorApprovedData { reason:string }
interface LowStockData { tenantId:string; productId:string; quantity:number; lowStock:number; productName:string }
interface BookingCreatedData { bookingId:string; tenantId:string; customerId:string; date:string; startTime:string; totalAmount:number; services:string[] }

function validateVendorApprovedPayload(d: unknown): d is VendorApprovedData {
  if (typeof d !== 'object' || !d) return false;
  const o = d as Record<string, unknown>;
  return typeof o.tenantId === 'string' && typeof o.tenantName === 'string' &&
         typeof o.ownerEmail === 'string' && typeof o.ownerName === 'string';
}

function validateLowStockPayload(d: unknown): d is LowStockData {
  if (typeof d !== 'object' || !d) return false;
  const o = d as Record<string, unknown>;
  return typeof o.tenantId === 'string' && typeof o.productId === 'string' &&
         typeof o.quantity === 'number' && typeof o.lowStock === 'number' &&
         typeof o.productName === 'string';
}

function validateBookingCreatedPayload(d: unknown): d is BookingCreatedData {
  if (typeof d !== 'object' || !d) return false;
  const o = d as Record<string, unknown>;
  return typeof o.bookingId === 'string' && typeof o.tenantId === 'string' &&
         typeof o.customerId === 'string' && typeof o.date === 'string' &&
         typeof o.startTime === 'string' && typeof o.totalAmount === 'number' &&
         Array.isArray(o.services);
}

describe('Event payload validators', () => {
  test('vendor/approved payload validates correctly', () => {
    expect(validateVendorApprovedPayload({
      tenantId: 't1', tenantName: 'Acme Salon', ownerEmail: 'a@b.com', ownerName: 'Priya',
    })).toBe(true);
  });
  test('vendor/approved rejects missing ownerEmail', () =>
    expect(validateVendorApprovedPayload({ tenantId: 't1', tenantName: 'X', ownerName: 'Y' })).toBe(false));

  test('inventory/low-stock payload validates correctly', () => {
    expect(validateLowStockPayload({
      tenantId: 't1', productId: 'p1', quantity: 3, lowStock: 10, productName: 'Shampoo',
    })).toBe(true);
  });
  test('low-stock rejects string quantity', () =>
    expect(validateLowStockPayload({ tenantId:'t1', productId:'p1', quantity:'3', lowStock:10, productName:'X' })).toBe(false));

  test('booking/created payload validates correctly', () => {
    expect(validateBookingCreatedPayload({
      bookingId: 'b1', tenantId: 't1', customerId: 'u1',
      date: '2026-08-01', startTime: '10:00', totalAmount: 599,
      services: ['Hair Cut'],
    })).toBe(true);
  });
  test('booking/created rejects missing services array', () =>
    expect(validateBookingCreatedPayload({
      bookingId:'b1', tenantId:'t1', customerId:'u1', date:'2026-08-01', startTime:'10:00', totalAmount:599,
    })).toBe(false));
});

// ─── Booking reminder — tomorrow date calculation ─────────────────

function computeTomorrow(today: Date): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('computeTomorrow', () => {
  test('adds one day', () =>
    expect(computeTomorrow(new Date('2026-07-31T00:00:00Z'))).toBe('2026-08-01'));
  test('handles end of month correctly', () =>
    expect(computeTomorrow(new Date('2026-08-31T00:00:00Z'))).toBe('2026-09-01'));
  test('handles year rollover', () =>
    expect(computeTomorrow(new Date('2026-12-31T00:00:00Z'))).toBe('2027-01-01'));
  test('handles Feb in a leap year', () =>
    expect(computeTomorrow(new Date('2028-02-28T00:00:00Z'))).toBe('2028-02-29'));
  test('returns YYYY-MM-DD format', () =>
    expect(computeTomorrow(new Date('2026-07-01T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});
