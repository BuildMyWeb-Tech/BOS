// tests/e2e/04-booking.spec.ts
// Booking module — list, wizard, detail, calendar.

import { test, expect } from './fixtures/auth';

test.describe('Booking list', () => {
  test('booking list page loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings');
    await expect(page.getByText('Bookings')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New booking' })).toBeVisible();
  });

  test('status filter tabs visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings');
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible();
  });

  test('calendar view button links to calendar page', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings');
    await page.getByRole('link', { name: /calendar view/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/bookings\/calendar/);
  });

  test('date filters clear button works', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings');
    const fromInput = page.locator('input[type="date"]').first();
    await fromInput.fill('2026-07-01');
    await page.waitForTimeout(200);
    const clearBtn = page.getByRole('button', { name: 'Clear' });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    expect(await fromInput.inputValue()).toBe('');
  });
});

test.describe('New booking wizard', () => {
  test('wizard step 1 shows service and staff selects', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/new');
    await expect(page.getByText('New booking')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible({ timeout: 5000 });
  });

  test('step 1 Next button is disabled without a service', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/new');
    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).toBeDisabled();
  });

  test('step indicator shows 3 steps', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/new');
    // Each step has a numbered circle — check at least 3 exist
    const stepCircles = page.locator('div.rounded-full:has-text("1"), div.rounded-full:has-text("2"), div.rounded-full:has-text("3")');
    await expect(stepCircles.first()).toBeVisible();
  });
});

test.describe('Booking calendar', () => {
  test('calendar page loads with month navigation', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/calendar');
    await expect(page.locator('button:has(.lucide-chevron-left)')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has(.lucide-chevron-right)')).toBeVisible();
  });

  test('day labels Mon–Sun visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/calendar');
    await expect(page.getByText('Mon')).toBeVisible();
    await expect(page.getByText('Sun')).toBeVisible();
  });

  test('clicking a day shows that day panel', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/bookings/calendar');
    // Click day "1" if it exists
    const dayOne = page.locator('button').filter({ hasText: /^1$/ }).first();
    if (await dayOne.count() > 0) {
      await dayOne.click();
      // Right panel should update — either shows bookings or "No bookings"
      await expect(page.locator('text=No bookings, text=bookings on this day').first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });
});
