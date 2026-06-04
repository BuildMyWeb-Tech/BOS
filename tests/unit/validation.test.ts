// tests/unit/validation.test.ts
// Unit tests for src/lib/validation.ts
// Pure logic — no DB, no HTTP. All schemas and the validate() helper.

import {
  loginSchema,
  registerSchema,
  refreshSchema,
  validate,
} from '@/lib/validation';

// ─────────────────────────────────────────────────────────────────
// loginSchema
// ─────────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  test('accepts valid email and password', () => {
    const result = loginSchema.safeParse({
      email:    'admin@bos.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  test('lowercases and trims email', () => {
    const result = loginSchema.safeParse({
      email:    '  Admin@BOS.com  ',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('admin@bos.com');
    }
  });

  test('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'notanemail', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  test('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'secret123' });
    expect(result.success).toBe(false);
  });

  test('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com' });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// registerSchema
// ─────────────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const valid = {
    name:     'Jane Doe',
    email:    'jane@example.com',
    password: 'strongpass1',
    phone:    '+91 9876543210',
  };

  test('accepts full valid input', () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  test('accepts without optional phone', () => {
    const { phone: _, ...noPhone } = valid;
    const result = registerSchema.safeParse(noPhone);
    expect(result.success).toBe(true);
  });

  test('rejects password shorter than 8 chars', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'short' });
    expect(result.success).toBe(false);
  });

  test('rejects name shorter than 2 chars', () => {
    const result = registerSchema.safeParse({ ...valid, name: 'J' });
    expect(result.success).toBe(false);
  });

  test('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'bademail' });
    expect(result.success).toBe(false);
  });

  test('lowercases email', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'Jane@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('jane@example.com');
  });

  test('rejects invalid phone format', () => {
    const result = registerSchema.safeParse({ ...valid, phone: 'not-a-phone!!!' });
    expect(result.success).toBe(false);
  });

  test('accepts valid Indian phone format', () => {
    const result = registerSchema.safeParse({ ...valid, phone: '+919876543210' });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// refreshSchema
// ─────────────────────────────────────────────────────────────────

describe('refreshSchema', () => {
  test('accepts a non-empty refresh token string', () => {
    const result = refreshSchema.safeParse({ refreshToken: 'eyJhbGc.payload.sig' });
    expect(result.success).toBe(true);
  });

  test('rejects empty string', () => {
    const result = refreshSchema.safeParse({ refreshToken: '' });
    expect(result.success).toBe(false);
  });

  test('rejects missing refreshToken', () => {
    const result = refreshSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// validate() helper
// ─────────────────────────────────────────────────────────────────

describe('validate()', () => {
  test('returns data and null errors on success', () => {
    const result = validate(loginSchema, { email: 'a@b.com', password: 'pass1234' });
    expect(result.errors).toBeNull();
    expect(result.data).not.toBeNull();
    expect(result.data?.email).toBe('a@b.com');
  });

  test('returns null data and errors object on failure', () => {
    const result = validate(loginSchema, { email: 'bademail', password: '' });
    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
    expect(typeof result.errors).toBe('object');
  });

  test('errors are keyed by field name', () => {
    const result = validate(loginSchema, { email: 'bademail', password: '' });
    expect(result.errors).toHaveProperty('email');
    expect(result.errors).toHaveProperty('password');
  });

  test('each error value is an array of strings', () => {
    const result = validate(loginSchema, { email: 'bad', password: '' });
    expect(Array.isArray(result.errors?.email)).toBe(true);
    expect(typeof result.errors?.email[0]).toBe('string');
  });

  test('handles completely empty input', () => {
    const result = validate(loginSchema, {});
    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
  });

  test('handles null input', () => {
    const result = validate(loginSchema, null);
    expect(result.data).toBeNull();
    expect(result.errors).not.toBeNull();
  });
});
