// tests/unit/auth.test.ts
// Unit tests for src/lib/auth.ts
// Covers: sign, verify, permission checks, role helpers

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isSuperAdmin,
  isVendorOwner,
  isStaff,
  isCustomer,
  type JwtPayload,
} from '@/lib/auth';

// ─── Test setup ───────────────────────────────────────────────────
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, JWT_SECRET: 'test-secret-for-unit-tests-only' };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

// ─── Fixtures ─────────────────────────────────────────────────────
const SUPER_ADMIN_PAYLOAD: Omit<JwtPayload, 'iat' | 'exp'> = {
  userId:      'user_001',
  tenantId:    null,
  role:        'SUPER_ADMIN',
  permissions: ['booking.create', 'product.edit', 'settings.manage'],
  email:       'admin@bos.com',
  name:        'Super Admin',
};

const STAFF_PAYLOAD: Omit<JwtPayload, 'iat' | 'exp'> = {
  userId:      'user_002',
  tenantId:    'tenant_abc',
  role:        'STAFF',
  permissions: ['booking.view', 'booking.create', 'customer.view'],
  email:       'staff@acme.com',
  name:        'Jane Staff',
};

const CUSTOMER_PAYLOAD: Omit<JwtPayload, 'iat' | 'exp'> = {
  userId:      'user_003',
  tenantId:    'tenant_abc',
  role:        'CUSTOMER',
  permissions: ['booking.view', 'orders.view'],
  email:       'customer@example.com',
  name:        'John Customer',
};

// ─────────────────────────────────────────────────────────────────
// signAccessToken + verifyAccessToken
// ─────────────────────────────────────────────────────────────────

describe('signAccessToken + verifyAccessToken', () => {
  test('signs a token and verifies it successfully', () => {
    const token   = signAccessToken(SUPER_ADMIN_PAYLOAD);
    const decoded = verifyAccessToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(SUPER_ADMIN_PAYLOAD.userId);
    expect(decoded?.role).toBe('SUPER_ADMIN');
    expect(decoded?.tenantId).toBeNull();
    expect(decoded?.permissions).toEqual(SUPER_ADMIN_PAYLOAD.permissions);
  });

  test('returns null for a tampered token', () => {
    const token    = signAccessToken(STAFF_PAYLOAD);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyAccessToken(tampered)).toBeNull();
  });

  test('returns null for an empty string', () => {
    expect(verifyAccessToken('')).toBeNull();
  });

  test('returns null when JWT_SECRET is wrong', () => {
    const token = signAccessToken(STAFF_PAYLOAD);
    process.env.JWT_SECRET = 'different-wrong-secret';
    expect(verifyAccessToken(token)).toBeNull();
  });

  test('throws if JWT_SECRET env var is missing', () => {
    delete process.env.JWT_SECRET;
    expect(() => signAccessToken(STAFF_PAYLOAD)).toThrow('JWT_SECRET is not set');
  });

  test('encodes tenantId correctly for staff', () => {
    const token   = signAccessToken(STAFF_PAYLOAD);
    const decoded = verifyAccessToken(token);
    expect(decoded?.tenantId).toBe('tenant_abc');
  });

  test('encodes null tenantId for super admin', () => {
    const token   = signAccessToken(SUPER_ADMIN_PAYLOAD);
    const decoded = verifyAccessToken(token);
    expect(decoded?.tenantId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// signRefreshToken + verifyRefreshToken
// ─────────────────────────────────────────────────────────────────

describe('signRefreshToken + verifyRefreshToken', () => {
  test('signs and verifies a refresh token', () => {
    const token   = signRefreshToken('user_001');
    const decoded = verifyRefreshToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe('user_001');
  });

  test('returns null if an access token is passed as refresh', () => {
    // Access token has type undefined, refresh token has type: 'refresh'
    const accessToken = signAccessToken(STAFF_PAYLOAD);
    expect(verifyRefreshToken(accessToken)).toBeNull();
  });

  test('returns null for tampered refresh token', () => {
    const token    = signRefreshToken('user_001');
    const tampered = token.slice(0, -4) + 'YYYY';
    expect(verifyRefreshToken(tampered)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  test('returns true if permission is in the list', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasPermission(payload, 'booking.create')).toBe(true);
  });

  test('returns false if permission is NOT in the list', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasPermission(payload, 'settings.manage')).toBe(false);
  });

  test('is case-sensitive', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasPermission(payload, 'Booking.Create')).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  test('returns true when all codes are present', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasAllPermissions(payload, ['booking.view', 'booking.create'])).toBe(true);
  });

  test('returns false when at least one code is missing', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasAllPermissions(payload, ['booking.view', 'product.create'])).toBe(false);
  });

  test('returns true for empty codes array', () => {
    const payload = { ...CUSTOMER_PAYLOAD } as JwtPayload;
    expect(hasAllPermissions(payload, [])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  test('returns true if any code matches', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasAnyPermission(payload, ['product.delete', 'booking.create'])).toBe(true);
  });

  test('returns false when no code matches', () => {
    const payload = { ...CUSTOMER_PAYLOAD } as JwtPayload;
    expect(hasAnyPermission(payload, ['product.create', 'settings.manage'])).toBe(false);
  });

  test('returns false for empty codes array', () => {
    const payload = { ...STAFF_PAYLOAD } as JwtPayload;
    expect(hasAnyPermission(payload, [])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Role helpers
// ─────────────────────────────────────────────────────────────────

describe('role helpers', () => {
  test('isSuperAdmin returns true only for SUPER_ADMIN', () => {
    expect(isSuperAdmin(SUPER_ADMIN_PAYLOAD as JwtPayload)).toBe(true);
    expect(isSuperAdmin(STAFF_PAYLOAD     as JwtPayload)).toBe(false);
    expect(isSuperAdmin(CUSTOMER_PAYLOAD  as JwtPayload)).toBe(false);
  });

  test('isVendorOwner', () => {
    const ownerPayload: JwtPayload = { ...STAFF_PAYLOAD, role: 'VENDOR_OWNER' };
    expect(isVendorOwner(ownerPayload)).toBe(true);
    expect(isVendorOwner(STAFF_PAYLOAD as JwtPayload)).toBe(false);
  });

  test('isStaff', () => {
    expect(isStaff(STAFF_PAYLOAD    as JwtPayload)).toBe(true);
    expect(isStaff(CUSTOMER_PAYLOAD as JwtPayload)).toBe(false);
  });

  test('isCustomer', () => {
    expect(isCustomer(CUSTOMER_PAYLOAD as JwtPayload)).toBe(true);
    expect(isCustomer(STAFF_PAYLOAD    as JwtPayload)).toBe(false);
  });
});
