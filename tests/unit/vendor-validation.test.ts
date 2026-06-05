// tests/unit/vendor-validation.test.ts
// Unit tests for vendorRegisterSchema and rejectVendorSchema from validation.ts

import { vendorRegisterSchema, rejectVendorSchema, validate } from '@/lib/validation';

// ─── Fixtures ─────────────────────────────────────────────────────

const validVendor = {
  businessName: 'Acme Salon',
  businessType: 'salon',
  description:  'A great salon',
  address:      '123 Main Street, Chennai',
  phone:        '+91 9876543210',
  website:      'https://acmesalon.com',
  modules: {
    booking:   true,
    inventory: true,
    billing:   true,
    ecommerce: false,
  },
  ownerName:     'Jane Owner',
  ownerEmail:    'jane@acmesalon.com',
  ownerPassword: 'strongpass1',
  ownerPhone:    '+91 9876543210',
};

// ─── vendorRegisterSchema ─────────────────────────────────────────

describe('vendorRegisterSchema — valid inputs', () => {
  test('accepts fully valid input', () => {
    const result = vendorRegisterSchema.safeParse(validVendor);
    expect(result.success).toBe(true);
  });

  test('accepts without optional website', () => {
    const { website: _, ...noWebsite } = validVendor;
    expect(vendorRegisterSchema.safeParse(noWebsite).success).toBe(true);
  });

  test('accepts with empty string website', () => {
    const result = vendorRegisterSchema.safeParse({ ...validVendor, website: '' });
    expect(result.success).toBe(true);
  });

  test('accepts without optional description', () => {
    const { description: _, ...noDesc } = validVendor;
    expect(vendorRegisterSchema.safeParse(noDesc).success).toBe(true);
  });

  test('accepts without optional ownerPhone', () => {
    const { ownerPhone: _, ...noPhone } = validVendor;
    expect(vendorRegisterSchema.safeParse(noPhone).success).toBe(true);
  });

  test('lowercases owner email', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      ownerEmail: 'JANE@ACMESALON.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownerEmail).toBe('jane@acmesalon.com');
    }
  });

  test('trims business name', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      businessName: '  Acme Salon  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBe('Acme Salon');
    }
  });
});

describe('vendorRegisterSchema — module validation', () => {
  test('rejects when no modules are selected', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      modules: { booking: false, inventory: false, billing: false, ecommerce: false },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hasModuleError = result.error.issues.some(
        i => i.message.includes('module')
      );
      expect(hasModuleError).toBe(true);
    }
  });

  test('accepts with only one module enabled', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      modules: { booking: true, inventory: false, billing: false, ecommerce: false },
    });
    expect(result.success).toBe(true);
  });

  test('accepts with all modules enabled', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      modules: { booking: true, inventory: true, billing: true, ecommerce: true },
    });
    expect(result.success).toBe(true);
  });
});

describe('vendorRegisterSchema — field validation', () => {
  test('rejects businessName shorter than 2 chars', () => {
    const result = vendorRegisterSchema.safeParse({ ...validVendor, businessName: 'A' });
    expect(result.success).toBe(false);
  });

  test('rejects businessName longer than 100 chars', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      businessName: 'A'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  test('rejects address shorter than 5 chars', () => {
    const result = vendorRegisterSchema.safeParse({ ...validVendor, address: 'abc' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid phone number', () => {
    const result = vendorRegisterSchema.safeParse({ ...validVendor, phone: 'abc' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid website URL', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      website: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid owner email', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      ownerEmail: 'notanemail',
    });
    expect(result.success).toBe(false);
  });

  test('rejects owner password shorter than 8 chars', () => {
    const result = vendorRegisterSchema.safeParse({
      ...validVendor,
      ownerPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  test('rejects missing businessName', () => {
    const { businessName: _, ...missing } = validVendor;
    expect(vendorRegisterSchema.safeParse(missing).success).toBe(false);
  });

  test('rejects missing ownerEmail', () => {
    const { ownerEmail: _, ...missing } = validVendor;
    expect(vendorRegisterSchema.safeParse(missing).success).toBe(false);
  });

  test('rejects missing modules field entirely', () => {
    const { modules: _, ...missing } = validVendor;
    expect(vendorRegisterSchema.safeParse(missing).success).toBe(false);
  });
});

// ─── rejectVendorSchema ───────────────────────────────────────────

describe('rejectVendorSchema', () => {
  test('accepts valid reason', () => {
    const result = rejectVendorSchema.safeParse({
      reason: 'Incomplete business documentation provided',
    });
    expect(result.success).toBe(true);
  });

  test('trims reason', () => {
    const result = rejectVendorSchema.safeParse({
      reason: '  Incomplete documentation  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe('Incomplete documentation');
    }
  });

  test('rejects reason shorter than 10 chars', () => {
    const result = rejectVendorSchema.safeParse({ reason: 'Too short' });
    expect(result.success).toBe(false);
  });

  test('rejects empty reason', () => {
    const result = rejectVendorSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing reason', () => {
    const result = rejectVendorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test('rejects reason longer than 500 chars', () => {
    const result = rejectVendorSchema.safeParse({ reason: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ─── validate() helper with vendor schema ────────────────────────

describe('validate() with vendorRegisterSchema', () => {
  test('returns structured field errors', () => {
    const result = validate(vendorRegisterSchema, {
      businessName: 'A',             // too short
      ownerEmail:   'bademail',      // invalid
      ownerPassword: 'short',        // too short
      modules: { booking: false, inventory: false, billing: false, ecommerce: false },
    });

    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
    expect(result.errors).toHaveProperty('businessName');
    expect(result.errors).toHaveProperty('ownerEmail');
    expect(result.errors).toHaveProperty('ownerPassword');
  });
});
