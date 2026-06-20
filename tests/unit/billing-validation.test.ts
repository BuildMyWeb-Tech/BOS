// tests/unit/billing-validation.test.ts
// Unit tests for Phase 6 schemas in validation.ts

import {
  createBillSchema,
  billListQuerySchema,
  updateTenantSettingsSchema,
  validate,
} from '@/lib/validation';

const VALID_CUID = 'clx0a1b2c0000a1b2c3d4e5f6';

// ─── createBillSchema ────────────────────────────────────────────────

describe('createBillSchema — valid inputs', () => {
  test('accepts minimal valid bill, single item', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 2 }],
      paymentMode: 'CASH',
    }).success).toBe(true);
  });

  test('accepts multiple items', () => {
    expect(createBillSchema.safeParse({
      items: [
        { productId: VALID_CUID, quantity: 2 },
        { productId: VALID_CUID, variantId: VALID_CUID, quantity: 1 },
      ],
      paymentMode: 'UPI',
    }).success).toBe(true);
  });

  test('accepts with billDiscount, paidAmount, note', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }],
      billDiscount: 50,
      paymentMode: 'CASH',
      paidAmount: 500,
      note: 'Regular customer',
    }).success).toBe(true);
  });

  test('accepts each valid payment mode', () => {
    for (const mode of ['CASH', 'UPI', 'CARD', 'SPLIT']) {
      expect(createBillSchema.safeParse({
        items: [{ productId: VALID_CUID, quantity: 1 }],
        paymentMode: mode,
      }).success).toBe(true);
    }
  });

  test('accepts per-line discount', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 2, discount: 20 }],
      paymentMode: 'CASH',
    }).success).toBe(true);
  });

  test('defaults billDiscount to 0 when omitted', () => {
    const r = createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }],
      paymentMode: 'CASH',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.billDiscount).toBe(0);
  });

  test('defaults line discount to 0 when omitted', () => {
    const r = createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }],
      paymentMode: 'CASH',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items[0].discount).toBe(0);
  });
});

describe('createBillSchema — invalid inputs', () => {
  test('rejects empty items array', () => {
    expect(createBillSchema.safeParse({ items: [], paymentMode: 'CASH' }).success).toBe(false);
  });

  test('rejects missing items', () => {
    expect(createBillSchema.safeParse({ paymentMode: 'CASH' }).success).toBe(false);
  });

  test('rejects missing paymentMode', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }],
    }).success).toBe(false);
  });

  test('rejects invalid paymentMode', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }], paymentMode: 'CHEQUE',
    }).success).toBe(false);
  });

  test('rejects zero quantity in a line', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 0 }], paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects negative quantity', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: -1 }], paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects non-integer quantity', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1.5 }], paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects negative line discount', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1, discount: -10 }], paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects negative billDiscount', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }], billDiscount: -10, paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects negative paidAmount', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }], paymentMode: 'CASH', paidAmount: -5,
    }).success).toBe(false);
  });

  test('rejects invalid productId cuid', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: 'bad-id', quantity: 1 }], paymentMode: 'CASH',
    }).success).toBe(false);
  });

  test('rejects note longer than 500 chars', () => {
    expect(createBillSchema.safeParse({
      items: [{ productId: VALID_CUID, quantity: 1 }], paymentMode: 'CASH', note: 'X'.repeat(501),
    }).success).toBe(false);
  });
});

// ─── billListQuerySchema ──────────────────────────────────────────────

describe('billListQuerySchema', () => {
  test('accepts empty query', () => {
    expect(billListQuerySchema.safeParse({}).success).toBe(true);
  });

  test('accepts valid date range', () => {
    expect(billListQuerySchema.safeParse({ from: '2026-06-01', to: '2026-06-30' }).success).toBe(true);
  });

  test('accepts from without to', () => {
    expect(billListQuerySchema.safeParse({ from: '2026-06-01' }).success).toBe(true);
  });

  test('rejects to before from', () => {
    expect(billListQuerySchema.safeParse({ from: '2026-06-30', to: '2026-06-01' }).success).toBe(false);
  });

  test('rejects invalid date format', () => {
    expect(billListQuerySchema.safeParse({ from: 'June 1' }).success).toBe(false);
  });
});

// ─── updateTenantSettingsSchema ────────────────────────────────────────

describe('updateTenantSettingsSchema', () => {
  test('accepts partial update — taxPercent only', () => {
    expect(updateTenantSettingsSchema.safeParse({ taxPercent: 12 }).success).toBe(true);
  });

  test('accepts full settings object', () => {
    expect(updateTenantSettingsSchema.safeParse({
      gstNumber: '29ABCDE1234F1Z5',
      taxType: 'SPLIT',
      cgst: 9, sgst: 9,
      currency: 'INR',
      showStoreName: true,
      showGST: true,
      footerMessage: 'Thanks for shopping!',
      defaultLowStock: 15,
    }).success).toBe(true);
  });

  test('accepts SINGLE taxType', () => {
    expect(updateTenantSettingsSchema.safeParse({ taxType: 'SINGLE', taxPercent: 18 }).success).toBe(true);
  });

  test('rejects invalid taxType', () => {
    expect(updateTenantSettingsSchema.safeParse({ taxType: 'DOUBLE' }).success).toBe(false);
  });

  test('rejects taxPercent over 100', () => {
    expect(updateTenantSettingsSchema.safeParse({ taxPercent: 150 }).success).toBe(false);
  });

  test('rejects negative cgst', () => {
    expect(updateTenantSettingsSchema.safeParse({ cgst: -5 }).success).toBe(false);
  });

  test('rejects empty object', () => {
    expect(updateTenantSettingsSchema.safeParse({}).success).toBe(false);
  });

  test('accepts null gstNumber (clearing it)', () => {
    expect(updateTenantSettingsSchema.safeParse({ gstNumber: null }).success).toBe(true);
  });

  test('rejects negative defaultLowStock', () => {
    expect(updateTenantSettingsSchema.safeParse({ defaultLowStock: -1 }).success).toBe(false);
  });

  test('rejects non-integer defaultLowStock', () => {
    expect(updateTenantSettingsSchema.safeParse({ defaultLowStock: 5.5 }).success).toBe(false);
  });
});

// ─── validate() integration ──────────────────────────────────────────

describe('validate() with billing schemas', () => {
  test('returns structured errors for invalid bill', () => {
    const result = validate(createBillSchema, { items: [], paymentMode: 'INVALID' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('items');
    expect(result.errors).toHaveProperty('paymentMode');
  });
});
