// tests/unit/orderMath.test.ts
// Unit tests for src/lib/ecommerce/orderMath.ts — pure functions, no mocks.

import { checkCouponEligibility, calculateOrderTotal, calculateOrderLineTotal } from '@/lib/ecommerce/orderMath';

const NOW = new Date('2026-06-20T12:00:00');
const FUTURE = new Date('2026-12-31T23:59:59');
const PAST = new Date('2026-01-01T00:00:00');

function baseCoupon(overrides: Partial<Parameters<typeof checkCouponEligibility>[0]> = {}) {
  return {
    code: 'SAVE50',
    discount: 50,
    forNewUser: false,
    forMember: false,
    isPublic: true,
    expiresAt: FUTURE,
    now: NOW,
    isNewCustomer: false,
    isMember: false,
    cartTotal: 500,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────
// checkCouponEligibility
// ─────────────────────────────────────────────────────────────────

describe('checkCouponEligibility — basic valid case', () => {
  test('accepts a fully eligible public coupon', () => {
    const result = checkCouponEligibility(baseCoupon());
    expect(result.valid).toBe(true);
    expect(result.discountedTotal).toBe(450);
  });
});

describe('checkCouponEligibility — expiry', () => {
  test('rejects an expired coupon', () => {
    const result = checkCouponEligibility(baseCoupon({ expiresAt: PAST }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/);
  });

  test('accepts a coupon expiring in the future', () => {
    const result = checkCouponEligibility(baseCoupon({ expiresAt: FUTURE }));
    expect(result.valid).toBe(true);
  });

  test('rejects a coupon that expired exactly now (boundary)', () => {
    const result = checkCouponEligibility(baseCoupon({ expiresAt: new Date(NOW.getTime() - 1) }));
    expect(result.valid).toBe(false);
  });
});

describe('checkCouponEligibility — forNewUser', () => {
  test('rejects new-user coupon for an existing customer', () => {
    const result = checkCouponEligibility(baseCoupon({ forNewUser: true, isNewCustomer: false }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/new customers/);
  });

  test('accepts new-user coupon for an actual new customer', () => {
    const result = checkCouponEligibility(baseCoupon({ forNewUser: true, isNewCustomer: true }));
    expect(result.valid).toBe(true);
  });

  test('non-new-user-restricted coupon works for existing customers', () => {
    const result = checkCouponEligibility(baseCoupon({ forNewUser: false, isNewCustomer: false }));
    expect(result.valid).toBe(true);
  });
});

describe('checkCouponEligibility — forMember', () => {
  test('rejects member-only coupon for a non-member', () => {
    const result = checkCouponEligibility(baseCoupon({ forMember: true, isMember: false }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/members/);
  });

  test('accepts member-only coupon for a member', () => {
    const result = checkCouponEligibility(baseCoupon({ forMember: true, isMember: true }));
    expect(result.valid).toBe(true);
  });
});

describe('checkCouponEligibility — isPublic', () => {
  test('rejects a non-public coupon', () => {
    const result = checkCouponEligibility(baseCoupon({ isPublic: false }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not valid/);
  });
});

describe('checkCouponEligibility — empty cart', () => {
  test('rejects when cartTotal is zero', () => {
    const result = checkCouponEligibility(baseCoupon({ cartTotal: 0 }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/empty/);
  });
});

describe('checkCouponEligibility — discount application', () => {
  test('clamps discountedTotal at zero when discount exceeds cart total', () => {
    const result = checkCouponEligibility(baseCoupon({ discount: 1000, cartTotal: 500 }));
    expect(result.valid).toBe(true);
    expect(result.discountedTotal).toBe(0);
  });

  test('calculates exact discounted total', () => {
    const result = checkCouponEligibility(baseCoupon({ discount: 100, cartTotal: 750 }));
    expect(result.discountedTotal).toBe(650);
  });
});

describe('checkCouponEligibility — check ordering priority', () => {
  test('reports expiry reason even when also non-public', () => {
    const result = checkCouponEligibility(baseCoupon({ expiresAt: PAST, isPublic: false }));
    expect(result.reason).toMatch(/expired/);
  });

  test('reports new-user reason before public-visibility reason', () => {
    const result = checkCouponEligibility(baseCoupon({
      forNewUser: true, isNewCustomer: false, isPublic: false,
    }));
    expect(result.reason).toMatch(/new customers/);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateOrderLineTotal
// ─────────────────────────────────────────────────────────────────

describe('calculateOrderLineTotal', () => {
  test('multiplies unit price by quantity', () => {
    expect(calculateOrderLineTotal(100, 3)).toBe(300);
  });

  test('rounds to 2 decimal places', () => {
    expect(calculateOrderLineTotal(33.333, 3)).toBe(100);
  });

  test('handles single quantity', () => {
    expect(calculateOrderLineTotal(299.99, 1)).toBe(299.99);
  });
});

// ─────────────────────────────────────────────────────────────────
// calculateOrderTotal
// ─────────────────────────────────────────────────────────────────

describe('calculateOrderTotal', () => {
  test('sums line totals with no coupon', () => {
    expect(calculateOrderTotal([100, 200, 50])).toBe(350);
  });

  test('applies a flat coupon discount', () => {
    expect(calculateOrderTotal([1000], 100)).toBe(900);
  });

  test('clamps discount that exceeds subtotal', () => {
    expect(calculateOrderTotal([100], 500)).toBe(0);
  });

  test('returns 0 for empty line array', () => {
    expect(calculateOrderTotal([])).toBe(0);
  });

  test('defaults couponDiscount to 0 when omitted', () => {
    expect(calculateOrderTotal([250])).toBe(250);
  });

  test('exact discount-equals-subtotal results in zero total', () => {
    expect(calculateOrderTotal([300], 300)).toBe(0);
  });
});
