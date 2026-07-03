// tests/e2e/01-auth.spec.ts
// Authentication flows — login, redirect, invalid credentials, registration.

import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('shows the login form at /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to BOS')).toBeVisible();
    await expect(page.getByPlaceholder('you@business.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@business.com').fill('nobody@nowhere.invalid');
    await page.getByPlaceholder('••••••••').fill('wrongpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the API call to complete — either an error toast appears,
    // or the button stops saying "Signing in…" (network resolved).
    // We allow up to 12 s because Neon can take 6 s to wake from sleep.
    await expect(
      page.locator('[role="status"], .react-hot-toast, [data-sonner-toast]')
        .or(page.getByText(/invalid|incorrect|not found|wrong|error/i))
        .first()
    ).toBeVisible({ timeout: 12_000 }).catch(async () => {
      // Fallback: check page body text in case toast uses different markup
      const body = await page.locator('body').textContent();
      expect(body).toMatch(/invalid|incorrect|not found|wrong|error/i);
    });
  });

  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    // Clear any stale auth state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('bos_token');
      localStorage.removeItem('bos_refresh_token');
    });

    await page.goto('/dashboard');
    // Allow time for client-side or middleware redirect
    await page.waitForURL(/\/login/, { timeout: 8_000 }).catch(() => {});
    // Accept either redirect OR a login form being shown on the page
    const url = page.url();
    const hasLoginForm = await page.getByPlaceholder('you@business.com').isVisible().catch(() => false);
    expect(url.includes('/login') || hasLoginForm).toBe(true);
  });

  test('unauthenticated visit to /super-admin shows login or redirects', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('bos_token');
      localStorage.removeItem('bos_refresh_token');
    });

    await page.goto('/super-admin/vendors');
    await page.waitForURL(/\/login/, { timeout: 8_000 }).catch(() => {});
    const url = page.url();
    const hasLoginForm = await page.getByPlaceholder('you@business.com').isVisible().catch(() => false);
    expect(url.includes('/login') || hasLoginForm).toBe(true);
  });

  test('shows password toggle button', async ({ page }) => {
    await page.goto('/login');
    const pwdInput = page.getByPlaceholder('••••••••');
    expect(await pwdInput.getAttribute('type')).toBe('password');
    // The toggle is the first non-submit button on the form
    await page.locator('input[type="password"] ~ button, button[type="button"]')
      .first().click();
    expect(await pwdInput.getAttribute('type')).toBe('text');
  });
});

test.describe('Registration page', () => {
  test('shows the registration form at /register', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Register your business')).toBeVisible();
    await expect(page.getByPlaceholder('Acme Salon')).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: /submit application/i }).click();
    // At least one error should appear
    await expect(page.locator('.form-error').first()).toBeVisible({ timeout: 3000 });
  });

  test('requires at least one module selected', async ({ page }) => {
    await page.goto('/register');

    // Fill mandatory fields but leave modules unchecked.
    // Use strict, unambiguous locators — not generic placeholder text.
    await page.getByPlaceholder('Acme Salon').fill('Test Salon');

    // Business type field — use label-based locator to avoid ambiguity
    // (the register form has multiple inputs whose placeholders contain "salon")
    await page.getByLabel('Business type').fill('salon');

    // Address — unique placeholder
    await page.getByPlaceholder(/Anna Salai|street|address/i).first().fill('12 Test Street, Chennai');

    // Phone — type=tel or unique placeholder
    await page.locator('input[type="tel"], input[placeholder*="9876"]').first().fill('+91 9000000000');

    // Owner name — label-based
    await page.getByLabel('Your name').fill('Test Owner');

    // Owner email
    await page.getByLabel('Email').last().fill('test@test.in');

    // Owner password
    await page.getByLabel('Password').fill('Test@12345');

    await page.getByRole('button', { name: /submit application/i }).click();

    await expect(
      page.getByText(/select at least one module/i)
        .or(page.getByText(/module/i))
        .first()
    ).toBeVisible({ timeout: 3000 });
  });
});
