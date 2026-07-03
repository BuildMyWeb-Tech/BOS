// tests/e2e/09-pwa.spec.ts
// PWA — manifest, service worker headers, health endpoint.

import { test, expect } from '@playwright/test';

test.describe('Web App Manifest', () => {
  test('manifest.json returns valid JSON', async ({ request }) => {
    const res  = await request.get('/manifest.json');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.name).toBeTruthy();
    expect(body.short_name).toBeTruthy();
    expect(body.start_url).toBeTruthy();
    expect(body.display).toBe('standalone');
    expect(body.icons).toBeInstanceOf(Array);
    expect(body.icons.length).toBeGreaterThan(0);
  });

  test('manifest.json has correct Content-Type', async ({ request }) => {
    const res = await request.get('/manifest.json');
    const ct  = res.headers()['content-type'] ?? '';
    expect(ct).toContain('manifest');
  });

  test('manifest.json has 192x192 icon', async ({ request }) => {
    const body = await (await request.get('/manifest.json')).json();
    const has192 = body.icons.some((i: { sizes: string }) => i.sizes === '192x192');
    expect(has192).toBe(true);
  });

  test('manifest.json has 512x512 icon', async ({ request }) => {
    const body = await (await request.get('/manifest.json')).json();
    const has512 = body.icons.some((i: { sizes: string }) => i.sizes === '512x512');
    expect(has512).toBe(true);
  });

  test('manifest.json has a maskable icon', async ({ request }) => {
    const body = await (await request.get('/manifest.json')).json();
    const hasMaskable = body.icons.some((i: { purpose?: string }) => i.purpose === 'maskable');
    expect(hasMaskable).toBe(true);
  });
});

test.describe('Service Worker', () => {
  test('sw.js is served with no-cache headers', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.ok()).toBe(true);
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toContain('no-cache');
  });

  test('sw.js has correct content-type', async ({ request }) => {
    const res = await request.get('/sw.js');
    const ct  = res.headers()['content-type'] ?? '';
    expect(ct).toContain('javascript');
  });

  test('sw.js body contains service worker install handler', async ({ request }) => {
    const res  = await request.get('/sw.js');
    const body = await res.text();
    expect(body).toContain('install');
    expect(body).toContain('activate');
    expect(body).toContain('fetch');
  });

  test('sw.js never caches /api/ routes', async ({ request }) => {
    const res  = await request.get('/sw.js');
    const body = await res.text();
    expect(body).toContain('/api/');
  });
});

test.describe('Health endpoint', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    // Neon free tier can take up to 6 s to wake from sleep.
    // We use a 20 s timeout and retry once so this is robust
    // even after a period of inactivity.
    let res = await request.get('/api/health', { timeout: 20_000 }).catch(() => null);

    // Retry once if first attempt failed or returned non-ok
    if (!res || !res.ok()) {
      await new Promise(r => setTimeout(r, 3000)); // give Neon 3 more seconds
      res = await request.get('/api/health', { timeout: 15_000 }).catch(() => null);
    }

    expect(res).not.toBeNull();
    expect(res!.ok()).toBe(true);
    const body = await res!.json();
    expect(body.status ?? body.success).toBeTruthy();
  });
});
