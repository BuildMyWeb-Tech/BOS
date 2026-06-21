// tests/unit/orderTransitions.test.ts
// Unit tests for src/lib/ecommerce/orderTransitions.ts

import { isValidOrderTransition, getAllowedNextStatuses, ORDER_TRANSITIONS } from '@/lib/ecommerce/orderTransitions';
import type { OrderStatus } from '@/types';

const ALL_STATUSES: OrderStatus[] = [
  'ORDER_PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED',
  'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED',
];

describe('ORDER_TRANSITIONS — structural completeness', () => {
  test('every OrderStatus has an entry in the map', () => {
    for (const status of ALL_STATUSES) {
      expect(ORDER_TRANSITIONS).toHaveProperty(status);
    }
  });
});

describe('isValidOrderTransition — forward progression happy path', () => {
  test('ORDER_PLACED -> PROCESSING is allowed', () => {
    expect(isValidOrderTransition('ORDER_PLACED', 'PROCESSING')).toBe(true);
  });
  test('PROCESSING -> SHIPPED is allowed', () => {
    expect(isValidOrderTransition('PROCESSING', 'SHIPPED')).toBe(true);
  });
  test('SHIPPED -> DELIVERED is allowed', () => {
    expect(isValidOrderTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });
  test('ORDER_PLACED -> CONFIRMED is allowed', () => {
    expect(isValidOrderTransition('ORDER_PLACED', 'CONFIRMED')).toBe(true);
  });
});

describe('isValidOrderTransition — illegal skips', () => {
  test('ORDER_PLACED -> DELIVERED is rejected (skips processing/shipping)', () => {
    expect(isValidOrderTransition('ORDER_PLACED', 'DELIVERED')).toBe(false);
  });
  test('ORDER_PLACED -> SHIPPED is rejected (skips processing)', () => {
    expect(isValidOrderTransition('ORDER_PLACED', 'SHIPPED')).toBe(false);
  });
  test('CONFIRMED -> DELIVERED is rejected', () => {
    expect(isValidOrderTransition('CONFIRMED', 'DELIVERED')).toBe(false);
  });
});

describe('isValidOrderTransition — terminal states cannot transition', () => {
  test('CANCELLED has no allowed transitions', () => {
    expect(getAllowedNextStatuses('CANCELLED')).toEqual([]);
  });
  test('REFUNDED has no allowed transitions', () => {
    expect(getAllowedNextStatuses('REFUNDED')).toEqual([]);
  });
  test('cannot transition CANCELLED -> ORDER_PLACED (resurrection blocked)', () => {
    expect(isValidOrderTransition('CANCELLED', 'ORDER_PLACED')).toBe(false);
  });
  test('cannot transition REFUNDED -> DELIVERED', () => {
    expect(isValidOrderTransition('REFUNDED', 'DELIVERED')).toBe(false);
  });
});

describe('isValidOrderTransition — cancellation allowed from active states', () => {
  test('ORDER_PLACED -> CANCELLED allowed', () => {
    expect(isValidOrderTransition('ORDER_PLACED', 'CANCELLED')).toBe(true);
  });
  test('PROCESSING -> CANCELLED allowed', () => {
    expect(isValidOrderTransition('PROCESSING', 'CANCELLED')).toBe(true);
  });
  test('DELIVERED -> CANCELLED NOT allowed (too late to cancel)', () => {
    expect(isValidOrderTransition('DELIVERED', 'CANCELLED')).toBe(false);
  });
  test('SHIPPED -> CANCELLED NOT allowed (in transit, use return flow instead)', () => {
    expect(isValidOrderTransition('SHIPPED', 'CANCELLED')).toBe(false);
  });
});

describe('isValidOrderTransition — return flow', () => {
  test('DELIVERED -> RETURN_REQUESTED allowed', () => {
    expect(isValidOrderTransition('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
  });
  test('SHIPPED -> RETURN_REQUESTED allowed (refused at door)', () => {
    expect(isValidOrderTransition('SHIPPED', 'RETURN_REQUESTED')).toBe(true);
  });
  test('RETURN_REQUESTED -> RETURNED allowed', () => {
    expect(isValidOrderTransition('RETURN_REQUESTED', 'RETURNED')).toBe(true);
  });
  test('RETURN_REQUESTED -> DELIVERED allowed (request denied, order stands)', () => {
    expect(isValidOrderTransition('RETURN_REQUESTED', 'DELIVERED')).toBe(true);
  });
  test('RETURNED -> REFUNDED allowed', () => {
    expect(isValidOrderTransition('RETURNED', 'REFUNDED')).toBe(true);
  });
  test('RETURNED -> DELIVERED NOT allowed (no going back from returned)', () => {
    expect(isValidOrderTransition('RETURNED', 'DELIVERED')).toBe(false);
  });
});

describe('getAllowedNextStatuses', () => {
  test('returns the correct set for ORDER_PLACED', () => {
    expect(getAllowedNextStatuses('ORDER_PLACED')).toEqual(['CONFIRMED', 'PROCESSING', 'CANCELLED']);
  });
  test('returns empty array for unknown-shaped input gracefully', () => {
    // @ts-expect-error testing defensive fallback for bad input
    expect(getAllowedNextStatuses('NOT_A_STATUS')).toEqual([]);
  });
});
