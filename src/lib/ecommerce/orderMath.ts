// src/lib/ecommerce/orderMath.ts
//
// Pure functions for ecommerce order math and coupon validation.
// No DB calls — the route handler loads the Coupon row and customer
// context, then passes plain data into these functions.

export interface CouponCheckInput {
  code:           string;
  discount:       number;  // flat amount off
  forNewUser:     boolean;
  forMember:      boolean;
  isPublic:       boolean;
  expiresAt:      Date;
  now:            Date;
  isNewCustomer:  boolean; // customer has zero prior completed orders
  isMember:       boolean; // tenant-defined "member" status — placeholder hook;
                            // always pass false unless the caller has a real
                            // membership concept to check
  cartTotal:      number;
}

export interface CouponCheckResult {
  valid:  boolean;
  reason?: string;
  discountedTotal?: number;
}

/**
 * Validate a coupon against cart + customer context.
 * Order of checks: expiry -> new-user-only -> member-only -> public visibility.
 * (isPublic is the least specific gate so it's checked last; a coupon
 * that's both expired AND non-public should report the expiry reason first
 * since that's usually the more actionable piece of information for the customer.)
 */
export function checkCouponEligibility(input: CouponCheckInput): CouponCheckResult {
  if (input.now > input.expiresAt) {
    return { valid: false, reason: 'This coupon has expired' };
  }

  if (input.forNewUser && !input.isNewCustomer) {
    return { valid: false, reason: 'This coupon is only valid for new customers' };
  }

  if (input.forMember && !input.isMember) {
    return { valid: false, reason: 'This coupon is only valid for members' };
  }

  if (!input.isPublic) {
    return { valid: false, reason: 'This coupon code is not valid' };
  }

  if (input.cartTotal <= 0) {
    return { valid: false, reason: 'Cart is empty' };
  }

  const discountedTotal = Math.max(0, round2(input.cartTotal - input.discount));

  return { valid: true, discountedTotal };
}

/**
 * Compute the order total from line totals plus an optional flat coupon
 * discount. Discount is clamped so the order can never go negative.
 */
export function calculateOrderTotal(lineTotals: number[], couponDiscount: number = 0): number {
  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));
  const discount = Math.min(couponDiscount, subtotal);
  return round2(Math.max(0, subtotal - discount));
}

/**
 * Compute a single order line total: unitPrice * quantity, rounded.
 */
export function calculateOrderLineTotal(unitPrice: number, quantity: number): number {
  return round2(unitPrice * quantity);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
