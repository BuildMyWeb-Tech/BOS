// tests/unit/tenant.test.ts
// Unit tests for src/lib/tenant.ts
// Pure logic functions only — no DB. DB-dependent functions tested in integration.

// ─── Mock prisma so it never connects ────────────────────────────
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

import { parseHost, isModuleEnabled } from '@/lib/tenant';

// ─── parseHost ───────────────────────────────────────────────────

describe('parseHost', () => {
  test('single subdomain on localhost', () => {
    expect(parseHost('acmesalon.localhost:3000')).toEqual({
      subdomain: 'acmesalon',
      hostname:  'localhost',
    });
  });

  test('bare localhost with port', () => {
    expect(parseHost('localhost:3000')).toEqual({
      subdomain: null,
      hostname:  'localhost',
    });
  });

  test('bare localhost without port', () => {
    expect(parseHost('localhost')).toEqual({
      subdomain: null,
      hostname:  'localhost',
    });
  });

  test('hyphenated subdomain on localhost', () => {
    expect(parseHost('city-gym.localhost:3000')).toEqual({
      subdomain: 'city-gym',
      hostname:  'localhost',
    });
  });

  test('bare custom domain — no subdomain', () => {
    const result = parseHost('salonabc.com');
    expect(result.subdomain).toBeNull();
    expect(result.hostname).toBe('salonabc.com');
  });

  test('www subdomain', () => {
    const result = parseHost('www.salonabc.com');
    expect(result.subdomain).toBe('www');
    expect(result.hostname).toBe('salonabc.com');
  });

  test('tenant subdomain on custom domain', () => {
    const result = parseHost('acme.bos-platform.com');
    expect(result.subdomain).toBe('acme');
    expect(result.hostname).toBe('bos-platform.com');
  });

  test('strips port from production domain', () => {
    const result = parseHost('salonabc.com:443');
    expect(result.subdomain).toBeNull();
    expect(result.hostname).toBe('salonabc.com');
  });

  test('three-level production domain', () => {
    const result = parseHost('tenant1.yourbos.com');
    expect(result.subdomain).toBe('tenant1');
    expect(result.hostname).toBe('yourbos.com');
  });

  test('empty string returns null subdomain', () => {
    const result = parseHost('');
    expect(result.subdomain).toBeNull();
  });
});

// ─── isModuleEnabled ─────────────────────────────────────────────

describe('isModuleEnabled', () => {
  const modules = {
    booking:   true,
    inventory: true,
    billing:   false,
    ecommerce: false,
  };

  test('returns true for an enabled module', () => {
    expect(isModuleEnabled(modules, 'booking')).toBe(true);
    expect(isModuleEnabled(modules, 'inventory')).toBe(true);
  });

  test('returns false for a disabled module', () => {
    expect(isModuleEnabled(modules, 'billing')).toBe(false);
    expect(isModuleEnabled(modules, 'ecommerce')).toBe(false);
  });

  test('returns false for an unknown module', () => {
    expect(isModuleEnabled(modules, 'unknown')).toBe(false);
  });

  test('returns false for an empty modules object', () => {
    expect(isModuleEnabled({}, 'booking')).toBe(false);
  });

  test('all modules enabled', () => {
    const allOn = { booking: true, inventory: true, billing: true, ecommerce: true };
    expect(isModuleEnabled(allOn, 'billing')).toBe(true);
  });
});
