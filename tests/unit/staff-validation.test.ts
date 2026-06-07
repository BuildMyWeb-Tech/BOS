// tests/unit/staff-validation.test.ts
// Unit tests for staff-related schemas in validation.ts

import {
  createStaffSchema,
  updateStaffSchema,
  updatePermissionsSchema,
  updateLeaveDatesSchema,
  validate,
} from '@/lib/validation';

// ─── createStaffSchema ────────────────────────────────────────────

const validStaff = {
  name:     'Jane Staff',
  email:    'jane@acmesalon.com',
  password: 'strongpass1',
  phone:    '+91 9876543210',
  bio:      'Senior stylist with 5 years experience',
  permissions: ['booking.view', 'booking.create'],
};

describe('createStaffSchema — valid inputs', () => {
  test('accepts fully valid input', () => {
    expect(createStaffSchema.safeParse(validStaff).success).toBe(true);
  });

  test('accepts without optional phone', () => {
    const { phone: _, ...rest } = validStaff;
    expect(createStaffSchema.safeParse(rest).success).toBe(true);
  });

  test('accepts without optional bio', () => {
    const { bio: _, ...rest } = validStaff;
    expect(createStaffSchema.safeParse(rest).success).toBe(true);
  });

  test('accepts without optional permissions', () => {
    const { permissions: _, ...rest } = validStaff;
    expect(createStaffSchema.safeParse(rest).success).toBe(true);
  });

  test('accepts with empty permissions array', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, permissions: [] }).success).toBe(true);
  });

  test('lowercases email', () => {
    const result = createStaffSchema.safeParse({ ...validStaff, email: 'JANE@ACMESALON.COM' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('jane@acmesalon.com');
  });

  test('trims name', () => {
    const result = createStaffSchema.safeParse({ ...validStaff, name: '  Jane Staff  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Jane Staff');
  });
});

describe('createStaffSchema — invalid inputs', () => {
  test('rejects missing name', () => {
    const { name: _, ...rest } = validStaff;
    expect(createStaffSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects name shorter than 2 chars', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, name: 'J' }).success).toBe(false);
  });

  test('rejects invalid email', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, email: 'notanemail' }).success).toBe(false);
  });

  test('rejects missing email', () => {
    const { email: _, ...rest } = validStaff;
    expect(createStaffSchema.safeParse(rest).success).toBe(false);
  });

  test('rejects password shorter than 8 chars', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, password: 'short' }).success).toBe(false);
  });

  test('rejects bio longer than 300 chars', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, bio: 'A'.repeat(301) }).success).toBe(false);
  });

  test('rejects invalid phone', () => {
    expect(createStaffSchema.safeParse({ ...validStaff, phone: 'notaphone' }).success).toBe(false);
  });
});

// ─── updateStaffSchema ────────────────────────────────────────────

describe('updateStaffSchema — valid inputs', () => {
  test('accepts name-only update', () => {
    expect(updateStaffSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  test('accepts phone-only update', () => {
    expect(updateStaffSchema.safeParse({ phone: '+91 9876543210' }).success).toBe(true);
  });

  test('accepts bio-only update', () => {
    expect(updateStaffSchema.safeParse({ bio: 'Updated bio' }).success).toBe(true);
  });

  test('accepts all fields together', () => {
    expect(updateStaffSchema.safeParse({
      name: 'Jane', phone: '+91 9876543210', bio: 'New bio',
    }).success).toBe(true);
  });

  test('trims name', () => {
    const result = updateStaffSchema.safeParse({ name: '  Trimmed  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Trimmed');
  });
});

describe('updateStaffSchema — invalid inputs', () => {
  test('rejects completely empty object', () => {
    expect(updateStaffSchema.safeParse({}).success).toBe(false);
  });

  test('rejects name shorter than 2 chars', () => {
    expect(updateStaffSchema.safeParse({ name: 'J' }).success).toBe(false);
  });

  test('rejects invalid phone', () => {
    expect(updateStaffSchema.safeParse({ phone: 'abc' }).success).toBe(false);
  });

  test('rejects bio longer than 300 chars', () => {
    expect(updateStaffSchema.safeParse({ bio: 'X'.repeat(301) }).success).toBe(false);
  });
});

// ─── updatePermissionsSchema ──────────────────────────────────────

describe('updatePermissionsSchema', () => {
  test('accepts valid permission codes array', () => {
    const result = updatePermissionsSchema.safeParse({
      permissions: ['booking.view', 'booking.create', 'product.view'],
    });
    expect(result.success).toBe(true);
  });

  test('accepts single permission', () => {
    expect(updatePermissionsSchema.safeParse({ permissions: ['booking.view'] }).success).toBe(true);
  });

  test('rejects empty array', () => {
    expect(updatePermissionsSchema.safeParse({ permissions: [] }).success).toBe(false);
  });

  test('rejects missing permissions field', () => {
    expect(updatePermissionsSchema.safeParse({}).success).toBe(false);
  });

  test('rejects array with empty string', () => {
    expect(updatePermissionsSchema.safeParse({ permissions: [''] }).success).toBe(false);
  });

  test('rejects non-array value', () => {
    expect(updatePermissionsSchema.safeParse({ permissions: 'booking.view' }).success).toBe(false);
  });
});

// ─── updateLeaveDatesSchema ───────────────────────────────────────

describe('updateLeaveDatesSchema', () => {
  test('accepts valid date strings', () => {
    const result = updateLeaveDatesSchema.safeParse({
      leaveDates: ['2025-12-25', '2026-01-01', '2026-01-26'],
    });
    expect(result.success).toBe(true);
  });

  test('accepts empty array (clear all leave dates)', () => {
    expect(updateLeaveDatesSchema.safeParse({ leaveDates: [] }).success).toBe(true);
  });

  test('rejects invalid date format', () => {
    expect(updateLeaveDatesSchema.safeParse({ leaveDates: ['25-12-2025'] }).success).toBe(false);
  });

  test('rejects non-date string', () => {
    expect(updateLeaveDatesSchema.safeParse({ leaveDates: ['christmas'] }).success).toBe(false);
  });

  test('rejects missing leaveDates field', () => {
    expect(updateLeaveDatesSchema.safeParse({}).success).toBe(false);
  });

  test('rejects array with mixed valid/invalid', () => {
    expect(updateLeaveDatesSchema.safeParse({
      leaveDates: ['2025-12-25', 'not-a-date'],
    }).success).toBe(false);
  });

  test('accepts exactly YYYY-MM-DD format', () => {
    expect(updateLeaveDatesSchema.safeParse({ leaveDates: ['2026-06-15'] }).success).toBe(true);
  });
});

// ─── validate() helper with staff schemas ────────────────────────

describe('validate() with staff schemas', () => {
  test('returns field errors for createStaff', () => {
    const result = validate(createStaffSchema, {
      name: 'J', email: 'bad', password: 'short',
    });
    expect(result.data).toBeNull();
    expect(result.errors).toHaveProperty('name');
    expect(result.errors).toHaveProperty('email');
    expect(result.errors).toHaveProperty('password');
  });

  test('returns error for empty updateStaff', () => {
    const result = validate(updateStaffSchema, {});
    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
  });
});
