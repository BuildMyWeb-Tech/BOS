// tests/unit/pwaManifest.test.ts
//
// Structural validation of public/manifest.json — catches typos/missing
// required fields that would silently break PWA installability without
// throwing any runtime error (browsers just decline to show the install
// prompt with no console warning in many cases).

import fs from 'fs';
import path from 'path';

const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

describe('manifest.json — required PWA fields', () => {
  test('has a name', () => {
    expect(typeof manifest.name).toBe('string');
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  test('has a short_name under 12 characters (home screen label limit)', () => {
    expect(typeof manifest.short_name).toBe('string');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  test('has a valid start_url', () => {
    expect(typeof manifest.start_url).toBe('string');
    expect(manifest.start_url.startsWith('/')).toBe(true);
  });

  test('has a valid display mode', () => {
    const validModes = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];
    expect(validModes).toContain(manifest.display);
  });

  test('has valid hex color strings for theme_color and background_color', () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    expect(manifest.theme_color).toMatch(hexPattern);
    expect(manifest.background_color).toMatch(hexPattern);
  });

  test('theme_color matches the layout.tsx viewport themeColor (#1e1b4b)', () => {
    // Keeps the manifest and the Next.js <meta name="theme-color"> tag
    // (set in layout.tsx viewport export) from drifting apart.
    expect(manifest.theme_color).toBe('#1e1b4b');
  });
});

describe('manifest.json — icons', () => {
  test('has at least one icon', () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('every icon has src, sizes, and type', () => {
    for (const icon of manifest.icons) {
      expect(typeof icon.src).toBe('string');
      expect(typeof icon.sizes).toBe('string');
      expect(typeof icon.type).toBe('string');
    }
  });

  test('includes a 192x192 icon (minimum required for installability)', () => {
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '192x192')).toBe(true);
  });

  test('includes a 512x512 icon (required for splash screens)', () => {
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });

  test('includes at least one maskable icon for adaptive home-screen icons', () => {
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('every icon src is a root-relative path', () => {
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(true);
    }
  });
});

describe('manifest.json — scope', () => {
  test('scope is set and start_url falls within it', () => {
    expect(typeof manifest.scope).toBe('string');
    expect(manifest.start_url.startsWith(manifest.scope) || manifest.scope === '/').toBe(true);
  });
});
