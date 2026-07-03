// tests/e2e/fixtures/auth.ts
//
// Playwright fixtures providing pre-authenticated page contexts.
// Each fixture logs in via the API (no UI) and stores the JWT in
// localStorage so every subsequent page.goto() starts authenticated.
//
// CREDENTIALS — set these in tests/e2e/.env.test (copy from .env.local):
//   E2E_SUPER_ADMIN_EMAIL=admin@yourbos.com
//   E2E_SUPER_ADMIN_PASSWORD=Admin@123456
//   E2E_VENDOR_EMAIL=priya@acmesalon.in
//   E2E_VENDOR_PASSWORD=Salon@12345
//   E2E_TENANT_HOST=acmesalon.localhost:3000   (only needed for subdomain routing)
//
// If the file is missing, tests that use vendorPage/superAdminPage will
// skip themselves (see skipIfNoCredentials helper below).

import { test as base, Page } from '@playwright/test';
import path from 'path';
import fs   from 'fs';

// ── Load test-specific env file (does not override existing env vars) ──
const envFile = path.join(__dirname, '.env.test');
if (fs.existsSync(envFile)) {
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val; // don't override shell env
  }
}

const SUPER_ADMIN = {
  email:    process.env.E2E_SUPER_ADMIN_EMAIL    ?? '',
  password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? '',
};

const VENDOR = {
  email:    process.env.E2E_VENDOR_EMAIL    ?? '',
  password: process.env.E2E_VENDOR_PASSWORD ?? '',
};

// ── DB wake-up ───────────────────────────────────────────────────────────
// Neon free tier suspends after ~5 minutes of inactivity.
// The first connection attempt can take 3–6 s to resume.
// We ping /api/health before the first login so the timeout budget
// isn't eaten by the cold-start.
let dbWarmedUp = false;
async function warmUpDb(page: Page): Promise<void> {
  if (dbWarmedUp) return;
  try {
    // /api/health must respond within 15 s; if it can't, Neon is
    // genuinely down and the error message will be informative.
    const res = await page.request.get('/api/health', { timeout: 15_000 });
    if (res.ok()) dbWarmedUp = true;
  } catch {
    // Non-fatal — login will surface the real error
  }
}

// ── localStorage helper ──────────────────────────────────────────────────
// We CANNOT write to localStorage while the page is at about:blank —
// Chromium treats it as a cross-origin frame and throws a SecurityError.
// Solution: navigate to the real app origin first, then write tokens.
async function injectTokens(
  page:         Page,
  token:        string,
  refreshToken: string
): Promise<void> {
  // Navigate to a page that definitely exists and is on the same origin
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.evaluate(
    ({ token, refreshToken }) => {
      localStorage.setItem('bos_token',         token);
      localStorage.setItem('bos_refresh_token', refreshToken);
    },
    { token, refreshToken }
  );
}

// ── Core login helper ────────────────────────────────────────────────────
async function loginAndStore(
  page:     Page,
  email:    string,
  password: string,
  role:     string
): Promise<void> {
  if (!email || !password) {
    throw new Error(
      `E2E credentials for ${role} are not set.\n` +
      `Create tests/e2e/.env.test with:\n` +
      `  E2E_${role.toUpperCase().replace(/ /g,'_')}_EMAIL=your@email\n` +
      `  E2E_${role.toUpperCase().replace(/ /g,'_')}_PASSWORD=yourpassword`
    );
  }

  await warmUpDb(page);

  const res  = await page.request.post('/api/auth/login', {
    data:    { email, password },
    headers: { 'Content-Type': 'application/json' },
    timeout: 20_000, // generous — Neon cold-start can take up to 6 s after warm-up
  });

  const json = await res.json();
  if (!json.success) {
    throw new Error(
      `Login failed for ${role} (${email}): ${json.error ?? 'unknown error'}\n` +
      `Make sure this user exists in your database and the password is correct.\n` +
      `Run: npx prisma db seed  (if you haven't already)`
    );
  }

  const { token, refreshToken } = json.data;
  await injectTokens(page, token, refreshToken);
}

// ── Fixtures ─────────────────────────────────────────────────────────────
type BosFixtures = {
  superAdminPage: Page;
  vendorPage:     Page;
};

export const test = base.extend<BosFixtures>({
  superAdminPage: async ({ page }, use) => {
    await loginAndStore(page, SUPER_ADMIN.email, SUPER_ADMIN.password, 'super admin');
    await use(page);
  },

  vendorPage: async ({ page }, use) => {
    await loginAndStore(page, VENDOR.email, VENDOR.password, 'vendor');
    await use(page);
  },
});

export { expect } from '@playwright/test';
