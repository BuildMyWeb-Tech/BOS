// tests/e2e/03-dashboard.spec.ts
// Dashboard shell — stat cards, sidebar navigation, module guards.

import { test, expect } from './fixtures/auth';

test.describe('Dashboard shell', () => {
  test('vendor reaches dashboard after login', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 5000 });
  });

  test('sidebar is visible with nav items', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('aside.sidebar')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('stat cards load on the dashboard', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    // Stat cards have the .stat-card class
    await expect(page.locator('.stat-card').first()).toBeVisible({ timeout: 6000 });
  });

  test('revenue section always shown', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText("Today's Revenue")).toBeVisible({ timeout: 5000 });
  });

  test('sidebar collapse button works on desktop', async ({ vendorPage: page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/dashboard');
    const sidebar = page.locator('aside.sidebar');
    // Click collapse toggle (ChevronLeft button)
    await page.locator('aside.sidebar button[title]').first().click();
    await expect(sidebar).toHaveClass(/collapsed/, { timeout: 2000 });
  });

  test('mobile sidebar opens with menu button', async ({ vendorPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    // Find the mobile menu button (TopBar hamburger)
    const menuBtn = page.locator('button[aria-label="menu"], button:has(svg.lucide-menu)').first();
    if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await expect(page.locator('aside.sidebar.mobile-open')).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Sidebar navigation', () => {
  test('clicking Bookings navigates to /dashboard/bookings', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Bookings' }).click();
    await expect(page).toHaveURL(/\/dashboard\/bookings/);
  });

  test('clicking Staff navigates to /dashboard/staff', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Staff' }).click();
    await expect(page).toHaveURL(/\/dashboard\/staff/);
  });

  test('clicking Settings navigates to settings hub', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test('clicking Reports navigates to reports hub', async ({ vendorPage: page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL(/\/dashboard\/reports/);
  });
});
