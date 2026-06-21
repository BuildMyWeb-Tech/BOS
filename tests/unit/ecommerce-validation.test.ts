// tests/unit/ecommerce-validation.test.ts
// Unit tests for Phase 7 schemas in validation.ts

import {
  addCartItemSchema,
  updateCartItemSchema,
  createAddressSchema,
  checkoutSchema,
  updateOrderStatusSchema,
  orderListQuerySchema,
  validateCouponSchema,
  validate,
} from '@/lib/validation';

const VALID_CUID = 'clx0a1b2c0000a1b2c3d4e5f6';

// ─── addCartItemSchema ───────────────────────────────────────────────

describe('addCartItemSchema', () => {
  test('accepts minimal valid item', () => {
    expect(addCartItemSchema.safeParse({ productId: VALID_CUID }).success).toBe(true);
  });
  test('defaults quantity to 1', () => {
    const r = addCartItemSchema.safeParse({ productId: VALID_CUID });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.quantity).toBe(1);
  });
  test('accepts with variantId and explicit quantity', () => {
    expect(addCartItemSchema.safeParse({
      productId: VALID_CUID, variantId: VALID_CUID, quantity: 3,
    }).success).toBe(true);
  });
  test('rejects missing productId', () => {
    expect(addCartItemSchema.safeParse({ quantity: 1 }).success).toBe(false);
  });
  test('rejects zero quantity', () => {
    expect(addCartItemSchema.safeParse({ productId: VALID_CUID, quantity: 0 }).success).toBe(false);
  });
  test('rejects quantity over 999', () => {
    expect(addCartItemSchema.safeParse({ productId: VALID_CUID, quantity: 1000 }).success).toBe(false);
  });
  test('rejects non-integer quantity', () => {
    expect(addCartItemSchema.safeParse({ productId: VALID_CUID, quantity: 1.5 }).success).toBe(false);
  });
});

describe('updateCartItemSchema', () => {
  test('accepts valid quantity', () => {
    expect(updateCartItemSchema.safeParse({ quantity: 5 }).success).toBe(true);
  });
  test('rejects missing quantity', () => {
    expect(updateCartItemSchema.safeParse({}).success).toBe(false);
  });
  test('rejects zero quantity (use DELETE to remove instead)', () => {
    expect(updateCartItemSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
});

// ─── createAddressSchema ─────────────────────────────────────────────

const validAddress = {
  name: 'Jane Doe', email: 'jane@example.com',
  street: '123 Main Street', city: 'Pondicherry', state: 'Puducherry',
  zip: '605001', country: 'India', phone: '+91 9876543210',
};

describe('createAddressSchema', () => {
  test('accepts a fully valid address', () => {
    expect(createAddressSchema.safeParse(validAddress).success).toBe(true);
  });
  test('rejects missing street', () => {
    const { street: _, ...rest } = validAddress;
    expect(createAddressSchema.safeParse(rest).success).toBe(false);
  });
  test('rejects short street address', () => {
    expect(createAddressSchema.safeParse({ ...validAddress, street: 'A' }).success).toBe(false);
  });
  test('rejects invalid email', () => {
    expect(createAddressSchema.safeParse({ ...validAddress, email: 'bad' }).success).toBe(false);
  });
  test('rejects invalid phone', () => {
    expect(createAddressSchema.safeParse({ ...validAddress, phone: 'abc' }).success).toBe(false);
  });
  test('rejects missing zip', () => {
    const { zip: _, ...rest } = validAddress;
    expect(createAddressSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── checkoutSchema ───────────────────────────────────────────────────

describe('checkoutSchema', () => {
  test('accepts minimal valid checkout', () => {
    expect(checkoutSchema.safeParse({ addressId: VALID_CUID, paymentMethod: 'COD' }).success).toBe(true);
  });
  test('accepts with couponCode', () => {
    expect(checkoutSchema.safeParse({
      addressId: VALID_CUID, paymentMethod: 'COD', couponCode: 'SAVE10',
    }).success).toBe(true);
  });
  test('accepts each valid payment method', () => {
    for (const method of ['COD', 'RAZORPAY', 'CASH', 'UPI', 'CARD']) {
      expect(checkoutSchema.safeParse({ addressId: VALID_CUID, paymentMethod: method }).success).toBe(true);
    }
  });
  test('rejects missing addressId', () => {
    expect(checkoutSchema.safeParse({ paymentMethod: 'COD' }).success).toBe(false);
  });
  test('rejects invalid addressId', () => {
    expect(checkoutSchema.safeParse({ addressId: 'bad', paymentMethod: 'COD' }).success).toBe(false);
  });
  test('rejects invalid paymentMethod', () => {
    expect(checkoutSchema.safeParse({ addressId: VALID_CUID, paymentMethod: 'BITCOIN' }).success).toBe(false);
  });
});

// ─── updateOrderStatusSchema ──────────────────────────────────────────

describe('updateOrderStatusSchema', () => {
  test('accepts each valid status', () => {
    const statuses = ['ORDER_PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CONFIRMED',
                       'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED'];
    for (const status of statuses) {
      expect(updateOrderStatusSchema.safeParse({ status }).success).toBe(true);
    }
  });
  test('accepts with optional note', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'SHIPPED', note: 'Via courier' }).success).toBe(true);
  });
  test('rejects invalid status', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'IN_TRANSIT' }).success).toBe(false);
  });
  test('rejects missing status', () => {
    expect(updateOrderStatusSchema.safeParse({}).success).toBe(false);
  });
});

// ─── orderListQuerySchema ─────────────────────────────────────────────

describe('orderListQuerySchema', () => {
  test('accepts empty query', () => {
    expect(orderListQuerySchema.safeParse({}).success).toBe(true);
  });
  test('accepts status filter', () => {
    expect(orderListQuerySchema.safeParse({ status: 'SHIPPED' }).success).toBe(true);
  });
  test('accepts valid date range', () => {
    expect(orderListQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' }).success).toBe(true);
  });
  test('rejects to before from', () => {
    expect(orderListQuerySchema.safeParse({ from: '2026-06-30', to: '2026-06-01' }).success).toBe(false);
  });
});

// ─── validateCouponSchema ─────────────────────────────────────────────

describe('validateCouponSchema', () => {
  test('accepts valid input', () => {
    expect(validateCouponSchema.safeParse({ code: 'SAVE10', cartTotal: 500 }).success).toBe(true);
  });
  test('rejects empty code', () => {
    expect(validateCouponSchema.safeParse({ code: '', cartTotal: 500 }).success).toBe(false);
  });
  test('rejects missing cartTotal', () => {
    expect(validateCouponSchema.safeParse({ code: 'SAVE10' }).success).toBe(false);
  });
  test('rejects negative cartTotal', () => {
    expect(validateCouponSchema.safeParse({ code: 'SAVE10', cartTotal: -10 }).success).toBe(false);
  });
  test('accepts zero cartTotal (schema-level; business logic rejects separately)', () => {
    expect(validateCouponSchema.safeParse({ code: 'SAVE10', cartTotal: 0 }).success).toBe(true);
  });
});

// ─── validate() integration ──────────────────────────────────────────

describe('validate() with ecommerce schemas', () => {
  test('returns structured errors for invalid checkout', () => {
    const result = validate(checkoutSchema, { addressId: 'bad', paymentMethod: 'BITCOIN' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('addressId');
    expect(result.errors).toHaveProperty('paymentMethod');
  });
});
