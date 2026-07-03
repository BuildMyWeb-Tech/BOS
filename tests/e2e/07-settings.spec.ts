// tests/e2e/07-settings.spec.ts
// Settings — hub page, billing settings, booking config, holiday calendar.

import { test, expect } from './fixtures/auth';

test.describe('Settings hub', () => {
  test('settings hub shows 3 sections', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByText('Billing & Tax')).toBeVisible();
    await expect(page.getByText('Booking Settings')).toBeVisible();
    await expect(page.getByText('Holidays & Closures')).toBeVisible();
  });

  test('billing settings link navigates correctly', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.getByText('Billing & Tax').click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/billing/);
  });

  test('booking settings link navigates correctly', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.getByText('Booking Settings').click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/booking/);
  });

  test('holidays link navigates correctly', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings');
    await page.getByText('Holidays & Closures').click();
    await expect(page).toHaveURL(/\/dashboard\/settings\/holidays/);
  });
});

test.describe('Billing settings', () => {
  test('billing settings form loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/billing');
    await expect(page.getByText('Billing & Tax')).toBeVisible();
    await expect(page.getByText('GST Configuration')).toBeVisible({ timeout: 5000 });
  });

  test('tax type radio buttons visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/billing');
    await expect(page.getByText('Single rate (GST%)')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Split (CGST + SGST)')).toBeVisible();
  });

  test('switching to SPLIT shows CGST and SGST fields', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/billing');
    await page.waitForTimeout(1000); // wait for data to load
    await page.getByText('Split (CGST + SGST)').click();
    await expect(page.getByText('CGST %')).toBeVisible();
    await expect(page.getByText('SGST %')).toBeVisible();
  });
});

test.describe('Booking settings', () => {
  test('booking settings form loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/booking');
    await expect(page.getByText('Booking Settings')).toBeVisible();
    await expect(page.getByText('Working Hours')).toBeVisible({ timeout: 5000 });
  });

  test('working day toggles visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/booking');
    await page.waitForTimeout(1000);
    // Days are shown as buttons (Mon, Tue, etc.)
    await expect(page.getByRole('button', { name: 'Mon' })).toBeVisible({ timeout: 5000 });
  });

  test('slot duration presets visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/booking');
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: '30 min' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Holiday calendar', () => {
  test('holiday page loads with calendar', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/holidays');
    await expect(page.getByText('Holidays & Closures')).toBeVisible();
    // Month/year header in the calendar
    const monthHeader = page.locator('span.font-semibold').filter({ hasText: /20\d\d/ }).first();
    await expect(monthHeader).toBeVisible({ timeout: 5000 });
  });

  test('block a date button shows modal', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/holidays');
    await page.getByRole('button', { name: /block a date/i }).click();
    await expect(page.getByText('Block a date')).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('add recurring holiday button shows modal', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/settings/holidays');
    await page.getByRole('button', { name: /recurring holiday/i }).click();
    await expect(page.getByText('Add recurring holiday')).toBeVisible();
  });
});
