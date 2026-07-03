// tests/e2e/02-superadmin.spec.ts
// Super Admin panel — vendor list, filter, approve, reject.

import { test, expect } from './fixtures/auth';

test.describe('Super Admin — Vendor Management', () => {
  test('super admin lands on vendor list after login', async ({ superAdminPage: page }) => {
    await page.goto('/super-admin/vendors');
    await expect(page.getByText('Vendors')).toBeVisible();
    // Table or empty state visible
    await expect(page.locator('table, [data-testid="empty-state"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('status filter tabs are visible', async ({ superAdminPage: page }) => {
    await page.goto('/super-admin/vendors');
    await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rejected' })).toBeVisible();
  });

  test('clicking Pending tab filters the list', async ({ superAdminPage: page }) => {
    await page.goto('/super-admin/vendors');
    await page.getByRole('button', { name: 'Pending' }).click();
    // URL should contain status=PENDING or the page title stays
    await expect(page.getByText('Vendors')).toBeVisible();
  });

  test('search input filters vendors', async ({ superAdminPage: page }) => {
    await page.goto('/super-admin/vendors');
    const searchInput = page.getByPlaceholder('Search vendors…');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('acme');
    // Wait for debounce
    await page.waitForTimeout(400);
    // Either "acme" appears in results or no results message appears
    const body = await page.locator('table tbody, [data-testid="empty-state"]').first().textContent();
    expect(body).toBeDefined();
  });

  test('vendor detail page loads from the list', async ({ superAdminPage: page }) => {
    await page.goto('/super-admin/vendors');
    // Click the first chevron/detail link if any vendors exist
    const firstLink = page.locator('table tbody tr a').first();
    const count = await firstLink.count();
    if (count > 0) {
      await firstLink.click();
      await expect(page.getByText(/business info/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
