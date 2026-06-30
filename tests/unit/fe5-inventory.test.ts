// tests/unit/fe5-inventory.test.ts
// Unit tests for FE-5 Inventory module pure logic.

// ─── Product form validation ──────────────────────────────────────

interface ProductFormErrors { name?: string; mrp?: string; variants?: string }

function validateProductForm(data: {
  name: string; mrp?: string; hasVariants: boolean;
  variants?: Array<{ size: string; price: string }>;
}): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!data.name.trim() || data.name.trim().length < 2)
    errors.name = 'Name must be at least 2 characters';
  if (!data.hasVariants) {
    if (!data.mrp || parseFloat(data.mrp) < 0)
      errors.mrp = 'MRP is required for products without variants';
  } else {
    if (!data.variants || data.variants.length === 0)
      errors.variants = 'Add at least one variant';
    else if (data.variants.some(v => !v.size.trim()))
      errors.variants = 'Every variant needs a size label';
    else if (data.variants.some(v => !v.price || parseFloat(v.price) < 0))
      errors.variants = 'Every variant needs a valid price';
  }
  return errors;
}

describe('validateProductForm', () => {
  const validSimple = { name: 'Shampoo', mrp: '500', hasVariants: false };
  const validVariant = {
    name: 'Apron', hasVariants: true,
    variants: [{ size: 'S', price: '299' }, { size: 'M', price: '349' }],
  };

  test('passes valid simple product', () =>
    expect(Object.keys(validateProductForm(validSimple))).toHaveLength(0));
  test('passes valid variant product', () =>
    expect(Object.keys(validateProductForm(validVariant))).toHaveLength(0));
  test('rejects short name', () =>
    expect(validateProductForm({ ...validSimple, name: 'X' })).toHaveProperty('name'));
  test('rejects empty name', () =>
    expect(validateProductForm({ ...validSimple, name: '' })).toHaveProperty('name'));
  test('rejects missing mrp for simple product', () =>
    expect(validateProductForm({ ...validSimple, mrp: '' })).toHaveProperty('mrp'));
  test('rejects negative mrp', () =>
    expect(validateProductForm({ ...validSimple, mrp: '-1' })).toHaveProperty('mrp'));
  test('rejects variant with missing size', () =>
    expect(validateProductForm({
      ...validVariant, variants: [{ size: '', price: '299' }],
    })).toHaveProperty('variants'));
  test('rejects variant with missing price', () =>
    expect(validateProductForm({
      ...validVariant, variants: [{ size: 'S', price: '' }],
    })).toHaveProperty('variants'));
  test('rejects empty variants array', () =>
    expect(validateProductForm({ ...validVariant, variants: [] })).toHaveProperty('variants'));
});

// ─── Stock status classification ──────────────────────────────────

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

function classifyStock(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0)          return 'out_of_stock';
  if (quantity <= threshold)  return 'low_stock';
  return 'in_stock';
}

function stockBadgeVariant(status: StockStatus): string {
  return status === 'in_stock' ? 'success' : status === 'low_stock' ? 'warning' : 'danger';
}

function stockBadgeLabel(status: StockStatus): string {
  return status === 'in_stock' ? 'In stock' : status === 'low_stock' ? 'Low stock' : 'Out of stock';
}

describe('classifyStock', () => {
  test('out_of_stock at zero',         () => expect(classifyStock(0, 10)).toBe('out_of_stock'));
  test('out_of_stock when negative',   () => expect(classifyStock(-1, 10)).toBe('out_of_stock'));
  test('low_stock at threshold',       () => expect(classifyStock(10, 10)).toBe('low_stock'));
  test('low_stock below threshold',    () => expect(classifyStock(3, 10)).toBe('low_stock'));
  test('in_stock above threshold',     () => expect(classifyStock(11, 10)).toBe('in_stock'));
  test('in_stock with zero threshold', () => expect(classifyStock(1, 0)).toBe('in_stock'));
});

describe('stockBadgeVariant', () => {
  test('in_stock → success',       () => expect(stockBadgeVariant('in_stock')).toBe('success'));
  test('low_stock → warning',      () => expect(stockBadgeVariant('low_stock')).toBe('warning'));
  test('out_of_stock → danger',    () => expect(stockBadgeVariant('out_of_stock')).toBe('danger'));
});

describe('stockBadgeLabel', () => {
  test('in_stock → In stock',      () => expect(stockBadgeLabel('in_stock')).toBe('In stock'));
  test('low_stock → Low stock',    () => expect(stockBadgeLabel('low_stock')).toBe('Low stock'));
  test('out_of_stock → Out of stock', () => expect(stockBadgeLabel('out_of_stock')).toBe('Out of stock'));
});

// ─── Stock adjustment validation ──────────────────────────────────

type AdjustReason = 'damaged' | 'lost' | 'correction' | 'returned' | 'other';
const VALID_REASONS: AdjustReason[] = ['damaged', 'lost', 'correction', 'returned', 'other'];

function validateAdjustment(delta: string, sign: 1 | -1, reason: string): string | null {
  const n = parseInt(delta);
  if (!delta || isNaN(n) || n <= 0)               return 'Enter a valid quantity greater than 0';
  if (!VALID_REASONS.includes(reason as AdjustReason)) return 'Select a valid reason';
  return null;
}

describe('validateAdjustment', () => {
  test('accepts positive delta with valid reason', () =>
    expect(validateAdjustment('5', 1, 'damaged')).toBeNull());
  test('accepts negative sign with valid reason', () =>
    expect(validateAdjustment('3', -1, 'lost')).toBeNull());
  test('rejects zero delta',    () => expect(validateAdjustment('0', 1, 'damaged')).not.toBeNull());
  test('rejects empty delta',   () => expect(validateAdjustment('', 1, 'damaged')).not.toBeNull());
  test('rejects invalid reason',() => expect(validateAdjustment('5', 1, 'broken')).not.toBeNull());
  test('rejects non-numeric string', () => expect(validateAdjustment('abc', 1, 'damaged')).not.toBeNull());
});

// ─── Stock summary helpers ────────────────────────────────────────

function summariseInventory(items: Array<{ stockStatus: StockStatus; quantity: number; mrp: number }>): {
  inStockCount: number; lowStockCount: number; outOfStockCount: number; totalValue: number;
} {
  return items.reduce((acc, item) => {
    if (item.stockStatus === 'in_stock')    acc.inStockCount++;
    if (item.stockStatus === 'low_stock')   acc.lowStockCount++;
    if (item.stockStatus === 'out_of_stock') acc.outOfStockCount++;
    acc.totalValue += item.mrp * item.quantity;
    return acc;
  }, { inStockCount: 0, lowStockCount: 0, outOfStockCount: 0, totalValue: 0 });
}

describe('summariseInventory', () => {
  const items = [
    { stockStatus: 'in_stock' as StockStatus, quantity: 50, mrp: 200 },
    { stockStatus: 'low_stock' as StockStatus, quantity: 3, mrp: 500 },
    { stockStatus: 'out_of_stock' as StockStatus, quantity: 0, mrp: 100 },
  ];

  test('counts each status correctly', () => {
    const result = summariseInventory(items);
    expect(result.inStockCount).toBe(1);
    expect(result.lowStockCount).toBe(1);
    expect(result.outOfStockCount).toBe(1);
  });
  test('calculates total value', () => {
    const result = summariseInventory(items);
    expect(result.totalValue).toBe(50 * 200 + 3 * 500 + 0 * 100);
  });
  test('returns zeros for empty input', () => {
    const result = summariseInventory([]);
    expect(result.inStockCount).toBe(0);
    expect(result.totalValue).toBe(0);
  });
});
