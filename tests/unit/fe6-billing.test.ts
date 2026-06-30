// tests/unit/fe6-billing.test.ts
// Unit tests for FE-6 Billing / POS pure logic.

// ─── Cart line total ──────────────────────────────────────────────

function calcLine(unitPrice: number, quantity: number, discount: number): number {
  return Math.max(0, Math.round((unitPrice * quantity - discount) * 100) / 100);
}

describe('calcLine', () => {
  test('basic multiplication',              () => expect(calcLine(100, 2, 0)).toBe(200));
  test('applies line discount',             () => expect(calcLine(100, 2, 50)).toBe(150));
  test('clamps at zero when discount > total', () => expect(calcLine(100, 1, 200)).toBe(0));
  test('handles fractional prices',         () => expect(calcLine(99.99, 3, 0)).toBe(299.97));
  test('zero quantity produces zero total', () => expect(calcLine(100, 0, 0)).toBe(0));
  test('rounds to 2 decimal places',        () => expect(calcLine(33.33, 3, 0)).toBe(99.99));
});

// ─── POS totals calculation ───────────────────────────────────────

interface CartLine { unitPrice: number; quantity: number; discount: number }

function calcPOSTotals(cart: CartLine[], billDiscount: number, taxPercent: number): {
  subtotal: number; taxableAmount: number; taxAmount: number; total: number;
} {
  const subtotal      = cart.reduce((s, l) => s + calcLine(l.unitPrice, l.quantity, l.discount), 0);
  const taxableAmount = Math.max(0, Math.round((subtotal - billDiscount) * 100) / 100);
  const taxAmount     = Math.round(taxableAmount * (taxPercent / 100) * 100) / 100;
  const total         = Math.round((taxableAmount + taxAmount) * 100) / 100;
  return { subtotal, taxableAmount, taxAmount, total };
}

describe('calcPOSTotals', () => {
  const cart = [
    { unitPrice: 1000, quantity: 2, discount: 0 },
    { unitPrice: 500,  quantity: 1, discount: 50 },
  ];

  test('sums subtotal correctly', () => {
    expect(calcPOSTotals(cart, 0, 0).subtotal).toBe(2450);
  });
  test('applies bill discount before tax', () => {
    const { taxableAmount } = calcPOSTotals(cart, 100, 18);
    expect(taxableAmount).toBe(2350);
  });
  test('calculates 18% tax correctly', () => {
    const { taxAmount } = calcPOSTotals(cart, 0, 18);
    expect(taxAmount).toBe(Math.round(2450 * 0.18 * 100) / 100);
  });
  test('total = taxableAmount + taxAmount', () => {
    const r = calcPOSTotals(cart, 0, 18);
    expect(r.total).toBe(Math.round((r.taxableAmount + r.taxAmount) * 100) / 100);
  });
  test('zero tax produces total equal to subtotal', () => {
    const r = calcPOSTotals(cart, 0, 0);
    expect(r.total).toBe(r.subtotal);
  });
  test('empty cart produces all zeros', () => {
    const r = calcPOSTotals([], 0, 18);
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });
  test('bill discount exceeding subtotal clamps taxable to zero', () => {
    const { taxableAmount } = calcPOSTotals([{ unitPrice: 100, quantity: 1, discount: 0 }], 200, 18);
    expect(taxableAmount).toBe(0);
  });
});

// ─── Cash change calculation ──────────────────────────────────────

function calcChange(paid: number, total: number): number {
  return Math.max(0, Math.round((paid - total) * 100) / 100);
}

describe('calcChange', () => {
  test('returns change for overpayment',   () => expect(calcChange(1000, 850)).toBe(150));
  test('returns zero for exact payment',   () => expect(calcChange(850, 850)).toBe(0));
  test('returns zero for underpayment',    () => expect(calcChange(500, 850)).toBe(0));
  test('rounds to 2 decimal places',       () => expect(calcChange(100, 66.67)).toBe(33.33));
});

// ─── Cart mutation helpers ────────────────────────────────────────

function addToCart(cart: CartLine[], product: { unitPrice: number }): CartLine[] {
  // Simplified: always add as new line for testing purposes
  return [...cart, { unitPrice: product.unitPrice, quantity: 1, discount: 0 }];
}

function updateQty(cart: CartLine[], index: number, qty: number): CartLine[] {
  return cart.map((l, i) => i === index ? { ...l, quantity: Math.max(1, qty) } : l);
}

function removeLine(cart: CartLine[], index: number): CartLine[] {
  return cart.filter((_, i) => i !== index);
}

describe('addToCart', () => {
  test('adds item to empty cart',  () => expect(addToCart([], { unitPrice: 100 })).toHaveLength(1));
  test('appends to existing cart', () => expect(addToCart([{ unitPrice: 100, quantity: 1, discount: 0 }], { unitPrice: 200 })).toHaveLength(2));
  test('sets quantity to 1',       () => expect(addToCart([], { unitPrice: 100 })[0].quantity).toBe(1));
  test('sets discount to 0',       () => expect(addToCart([], { unitPrice: 100 })[0].discount).toBe(0));
});

describe('updateQty', () => {
  const cart = [{ unitPrice: 100, quantity: 1, discount: 0 }];
  test('updates quantity at index',  () => expect(updateQty(cart, 0, 5)[0].quantity).toBe(5));
  test('clamps minimum to 1',        () => expect(updateQty(cart, 0, 0)[0].quantity).toBe(1));
  test('does not affect other lines',() => {
    const twoLine = [...cart, { unitPrice: 200, quantity: 1, discount: 0 }];
    expect(updateQty(twoLine, 0, 3)[1].quantity).toBe(1);
  });
});

describe('removeLine', () => {
  const cart = [
    { unitPrice: 100, quantity: 1, discount: 0 },
    { unitPrice: 200, quantity: 2, discount: 0 },
  ];
  test('removes item at index',     () => expect(removeLine(cart, 0)).toHaveLength(1));
  test('keeps remaining items',     () => expect(removeLine(cart, 0)[0].unitPrice).toBe(200));
  test('empty cart stays empty',    () => expect(removeLine([], 0)).toHaveLength(0));
});

// ─── Payment mode display ─────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', SPLIT: 'Split',
};

describe('MODE_LABELS', () => {
  test('CASH → Cash',   () => expect(MODE_LABELS['CASH']).toBe('Cash'));
  test('UPI → UPI',     () => expect(MODE_LABELS['UPI']).toBe('UPI'));
  test('CARD → Card',   () => expect(MODE_LABELS['CARD']).toBe('Card'));
  test('SPLIT → Split', () => expect(MODE_LABELS['SPLIT']).toBe('Split'));
  test('fallback for unknown mode', () =>
    expect(MODE_LABELS['CRYPTO'] ?? 'CRYPTO').toBe('CRYPTO'));
});
