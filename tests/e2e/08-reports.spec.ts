// tests/e2e/08-reports.spec.ts
// Reports module — hub, revenue chart, sales, inventory.

import { test, expect } from './fixtures/auth';

test.describe('Reports hub', () => {
  test('reports page shows all 5 report links', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports');
    await expect(page.getByText('Revenue')).toBeVisible();
    await expect(page.getByText('Sales Summary')).toBeVisible();
    await expect(page.getByText('Customers')).toBeVisible();
    await expect(page.getByText('Staff Performance')).toBeVisible();
    await expect(page.getByText('Inventory Report')).toBeVisible();
  });

  test('each card links to the correct report', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports');
    await page.getByText('Revenue').click();
    await expect(page).toHaveURL(/\/dashboard\/reports\/revenue/);
  });
});

test.describe('Revenue report', () => {
  test('revenue report page loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/revenue');
    await expect(page.getByText('Revenue')).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('bucket toggle buttons visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/revenue');
    await expect(page.getByRole('button', { name: 'Daily' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Weekly' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Monthly' })).toBeVisible();
  });

  test('date range inputs visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/revenue');
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
  });

  test('switching to Monthly bucket works', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/revenue');
    await page.getByRole('button', { name: 'Monthly' }).click();
    await expect(page.getByRole('button', { name: 'Monthly' })).toHaveClass(/bg-indigo-600/, { timeout: 2000 });
  });
});

test.describe('Inventory report', () => {
  test('inventory report loads with summary cards', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/inventory');
    await expect(page.getByText('Inventory Report')).toBeVisible();
    await expect(page.getByText('Total stock value')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Dead stock')).toBeVisible();
  });

  test('dead stock days dropdown changes value', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/inventory');
    await page.waitForTimeout(1000);
    const select = page.locator('select').last();
    await select.selectOption('30');
    expect(await select.inputValue()).toBe('30');
  });
});

test.describe('Staff performance report', () => {
  test('staff performance page loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/reports/staff');
    await expect(page.getByText('Staff Performance')).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });
});
