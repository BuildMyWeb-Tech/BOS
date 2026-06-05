// tests/unit/slug.test.ts
// Unit tests for src/lib/slug.ts
// Tests the pure generateSlugFromName() function.
// generateUniqueSlug() (DB-dependent) tested in integration.

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tenant: { findUnique: jest.fn() },
  },
}));

import { generateSlugFromName } from '@/lib/slug';

describe('generateSlugFromName', () => {
  // ── Basic transformations ───────────────────────────────────────

  test('converts to lowercase', () => {
    expect(generateSlugFromName('Acme Salon')).toBe('acme-salon');
  });

  test('replaces spaces with hyphens', () => {
    expect(generateSlugFromName('my business name')).toBe('my-business-name');
  });

  test('trims leading and trailing whitespace', () => {
    expect(generateSlugFromName('  My Gym  ')).toBe('my-gym');
  });

  test('collapses multiple spaces into one hyphen', () => {
    expect(generateSlugFromName('my   big   salon')).toBe('my-big-salon');
  });

  test('removes special characters', () => {
    expect(generateSlugFromName('Acme Salon & Spa')).toBe('acme-salon-spa');
  });

  test('removes dots and apostrophes', () => {
    expect(generateSlugFromName("Dr. John's Clinic")).toBe('dr-johns-clinic');
  });

  test('removes parentheses and brackets', () => {
    expect(generateSlugFromName('Gym (Pro) [Elite]')).toBe('gym-pro-elite');
  });

  test('collapses multiple hyphens', () => {
    expect(generateSlugFromName('a---b')).toBe('a-b');
  });

  test('strips leading hyphens', () => {
    expect(generateSlugFromName('---Acme')).toBe('acme');
  });

  test('strips trailing hyphens', () => {
    expect(generateSlugFromName('Acme---')).toBe('acme');
  });

  // ── Edge cases ──────────────────────────────────────────────────

  test('preserves numbers', () => {
    expect(generateSlugFromName('Salon 360')).toBe('salon-360');
  });

  test('handles all-numeric name', () => {
    expect(generateSlugFromName('360')).toBe('360');
  });

  test('truncates to 50 characters', () => {
    const longName = 'A'.repeat(60) + ' Business';
    const slug = generateSlugFromName(longName);
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  test('handles single word', () => {
    expect(generateSlugFromName('Salon')).toBe('salon');
  });

  test('handles empty string', () => {
    expect(generateSlugFromName('')).toBe('');
  });

  test('handles only special characters', () => {
    expect(generateSlugFromName('!@#$%^&*()')).toBe('');
  });

  test('handles mixed case with numbers and hyphens', () => {
    expect(generateSlugFromName('My Salon-2024')).toBe('my-salon-2024');
  });

  test('real-world: Indian business name', () => {
    expect(generateSlugFromName('Sri Sai Medical Billing')).toBe('sri-sai-medical-billing');
  });

  test('real-world: salon with ampersand', () => {
    expect(generateSlugFromName('Cut & Color Studio')).toBe('cut-color-studio');
  });

  test('real-world: clinic with period', () => {
    expect(generateSlugFromName('Dr. Priya Dental Clinic')).toBe('dr-priya-dental-clinic');
  });
});
