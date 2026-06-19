// tests/unit/inventory-validation.test.ts
// Unit tests for Phase 5 schemas in validation.ts

import {
  productCategorySchema,
  updateProductCategorySchema,
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
  addVariantSchema,
  updateVariantSchema,
  createBatchSchema,
  adjustInventorySchema,
  validate,
} from '@/lib/validation';

const VALID_CUID = 'clx0a1b2c0000a1b2c3d4e5f6';

// ─── productCategorySchema ───────────────────────────────────────────

describe('productCategorySchema', () => {
  test('accepts valid name', () => {
    expect(productCategorySchema.safeParse({ name: 'Skincare' }).success).toBe(true);
  });
  test('accepts with description and image', () => {
    expect(productCategorySchema.safeParse({
      name: 'Skincare', description: 'Skin products', image: 'https://example.com/img.jpg',
    }).success).toBe(true);
  });
  test('rejects name shorter than 2 chars', () => {
    expect(productCategorySchema.safeParse({ name: 'S' }).success).toBe(false);
  });
  test('rejects invalid image URL', () => {
    expect(productCategorySchema.safeParse({ name: 'Skincare', image: 'not-a-url' }).success).toBe(false);
  });
  test('accepts empty string image', () => {
    expect(productCategorySchema.safeParse({ name: 'Skincare', image: '' }).success).toBe(true);
  });
});

describe('updateProductCategorySchema', () => {
  test('accepts partial update', () => {
    expect(updateProductCategorySchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateProductCategorySchema.safeParse({}).success).toBe(false);
  });
});

// ─── createProductSchema ─────────────────────────────────────────────

describe('createProductSchema — valid inputs', () => {
  test('accepts a simple product with mrp, no variants', () => {
    expect(createProductSchema.safeParse({ name: 'Shampoo', mrp: 299 }).success).toBe(true);
  });

  test('accepts a product with variants and no mrp', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt',
      variants: [{ size: 'M', price: 499 }, { size: 'L', price: 549 }],
    }).success).toBe(true);
  });

  test('accepts a product with both mrp and variants', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt', mrp: 499,
      variants: [{ size: 'M', price: 499 }],
    }).success).toBe(true);
  });

  test('accepts with initialQuantity for a no-variant product', () => {
    expect(createProductSchema.safeParse({
      name: 'Shampoo', mrp: 299, initialQuantity: 50,
    }).success).toBe(true);
  });

  test('accepts with categoryId, sku, keyFeatures, images', () => {
    expect(createProductSchema.safeParse({
      name: 'Shampoo', mrp: 299,
      categoryId: VALID_CUID, sku: 'SHM-001',
      keyFeatures: ['Sulfate-free', 'For dry hair'],
      images: ['https://example.com/1.jpg'],
    }).success).toBe(true);
  });

  test('accepts variant with optional barcode', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt',
      variants: [{ size: 'M', price: 499, barcode: '8901234567890' }],
    }).success).toBe(true);
  });
});

describe('createProductSchema — invalid inputs', () => {
  test('rejects missing both mrp and variants', () => {
    expect(createProductSchema.safeParse({ name: 'Shampoo' }).success).toBe(false);
  });

  test('rejects initialQuantity combined with variants', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt',
      variants: [{ size: 'M', price: 499 }],
      initialQuantity: 10,
    }).success).toBe(false);
  });

  test('rejects missing name', () => {
    expect(createProductSchema.safeParse({ mrp: 299 }).success).toBe(false);
  });

  test('rejects negative mrp', () => {
    expect(createProductSchema.safeParse({ name: 'Shampoo', mrp: -10 }).success).toBe(false);
  });

  test('rejects negative initialQuantity', () => {
    expect(createProductSchema.safeParse({ name: 'Shampoo', mrp: 299, initialQuantity: -5 }).success).toBe(false);
  });

  test('rejects non-integer initialQuantity', () => {
    expect(createProductSchema.safeParse({ name: 'Shampoo', mrp: 299, initialQuantity: 5.5 }).success).toBe(false);
  });

  test('rejects variant with missing size', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt', variants: [{ price: 499 }],
    }).success).toBe(false);
  });

  test('rejects variant with negative price', () => {
    expect(createProductSchema.safeParse({
      name: 'T-Shirt', variants: [{ size: 'M', price: -10 }],
    }).success).toBe(false);
  });

  test('rejects more than 50 variants', () => {
    const variants = Array.from({ length: 51 }, (_, i) => ({ size: `S${i}`, price: 100 }));
    expect(createProductSchema.safeParse({ name: 'T-Shirt', variants }).success).toBe(false);
  });

  test('rejects more than 10 images', () => {
    const images = Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(createProductSchema.safeParse({ name: 'Shampoo', mrp: 299, images }).success).toBe(false);
  });

  test('rejects invalid category cuid', () => {
    expect(createProductSchema.safeParse({
      name: 'Shampoo', mrp: 299, categoryId: 'bad-id',
    }).success).toBe(false);
  });
});

describe('updateProductSchema', () => {
  test('accepts partial — name only', () => {
    expect(updateProductSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });
  test('accepts inStock toggle', () => {
    expect(updateProductSchema.safeParse({ inStock: false }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(false);
  });
});

// ─── productListQuerySchema ──────────────────────────────────────────

describe('productListQuerySchema', () => {
  test('accepts fully empty query', () => {
    expect(productListQuerySchema.safeParse({}).success).toBe(true);
  });
  test('accepts categoryId filter', () => {
    expect(productListQuerySchema.safeParse({ categoryId: VALID_CUID }).success).toBe(true);
  });
  test('accepts each valid stockStatus', () => {
    for (const s of ['in_stock', 'low_stock', 'out_of_stock']) {
      expect(productListQuerySchema.safeParse({ stockStatus: s }).success).toBe(true);
    }
  });
  test('rejects invalid stockStatus', () => {
    expect(productListQuerySchema.safeParse({ stockStatus: 'overstocked' }).success).toBe(false);
  });
});

// ─── addVariantSchema / updateVariantSchema ──────────────────────────

describe('addVariantSchema', () => {
  test('accepts valid variant', () => {
    expect(addVariantSchema.safeParse({ size: 'XL', price: 599 }).success).toBe(true);
  });
  test('rejects missing size', () => {
    expect(addVariantSchema.safeParse({ price: 599 }).success).toBe(false);
  });
  test('rejects missing price', () => {
    expect(addVariantSchema.safeParse({ size: 'XL' }).success).toBe(false);
  });
});

describe('updateVariantSchema', () => {
  test('accepts price-only update', () => {
    expect(updateVariantSchema.safeParse({ price: 649 }).success).toBe(true);
  });
  test('rejects empty object', () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(false);
  });
});

// ─── createBatchSchema ────────────────────────────────────────────────

describe('createBatchSchema', () => {
  test('accepts minimal valid batch', () => {
    expect(createBatchSchema.safeParse({ quantity: 100 }).success).toBe(true);
  });
  test('accepts with variantId, batchNumber, expiryDate', () => {
    expect(createBatchSchema.safeParse({
      variantId: VALID_CUID, batchNumber: 'B-2026-001', expiryDate: '2027-01-01', quantity: 50,
    }).success).toBe(true);
  });
  test('rejects missing quantity', () => {
    expect(createBatchSchema.safeParse({}).success).toBe(false);
  });
  test('rejects zero quantity', () => {
    expect(createBatchSchema.safeParse({ quantity: 0 }).success).toBe(false);
  });
  test('rejects negative quantity', () => {
    expect(createBatchSchema.safeParse({ quantity: -10 }).success).toBe(false);
  });
  test('rejects non-integer quantity', () => {
    expect(createBatchSchema.safeParse({ quantity: 10.5 }).success).toBe(false);
  });
  test('rejects invalid expiryDate format', () => {
    expect(createBatchSchema.safeParse({ quantity: 10, expiryDate: 'Jan 2027' }).success).toBe(false);
  });
});

// ─── adjustInventorySchema ────────────────────────────────────────────

describe('adjustInventorySchema', () => {
  test('accepts positive delta with valid reason', () => {
    expect(adjustInventorySchema.safeParse({ delta: 10, reason: 'correction' }).success).toBe(true);
  });
  test('accepts negative delta', () => {
    expect(adjustInventorySchema.safeParse({ delta: -5, reason: 'damaged' }).success).toBe(true);
  });
  test('accepts with optional note', () => {
    expect(adjustInventorySchema.safeParse({
      delta: -5, reason: 'lost', note: 'Found during stock take',
    }).success).toBe(true);
  });
  test('rejects zero delta', () => {
    expect(adjustInventorySchema.safeParse({ delta: 0, reason: 'correction' }).success).toBe(false);
  });
  test('rejects non-integer delta', () => {
    expect(adjustInventorySchema.safeParse({ delta: 5.5, reason: 'correction' }).success).toBe(false);
  });
  test('rejects invalid reason', () => {
    expect(adjustInventorySchema.safeParse({ delta: 10, reason: 'magic' }).success).toBe(false);
  });
  test('rejects missing reason', () => {
    expect(adjustInventorySchema.safeParse({ delta: 10 }).success).toBe(false);
  });
  test('accepts all valid reason values', () => {
    for (const reason of ['damaged', 'lost', 'correction', 'returned', 'other']) {
      expect(adjustInventorySchema.safeParse({ delta: 5, reason }).success).toBe(true);
    }
  });
});

// ─── validate() integration ──────────────────────────────────────────

describe('validate() with inventory schemas', () => {
  test('returns structured errors for invalid createProduct', () => {
    const result = validate(createProductSchema, { name: 'X' });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('mrp');
  });
});
