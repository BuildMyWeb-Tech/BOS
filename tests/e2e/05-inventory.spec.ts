// tests/e2e/05-inventory.spec.ts
// Inventory module — product list, create product form.

import { test, expect } from './fixtures/auth';

test.describe('Inventory dashboard', () => {
  test('inventory page loads with summary cards', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory');
    await expect(page.getByText('Inventory')).toBeVisible();
    await expect(page.getByText('In stock')).toBeVisible();
    await expect(page.getByText('Low stock')).toBeVisible();
    await expect(page.getByText('Out of stock')).toBeVisible();
  });

  test('Add product button navigates to create form', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory');
    await page.getByRole('link', { name: /add product/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/inventory\/products\/new/);
  });
});

test.describe('Product list', () => {
  test('product list page loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products');
    await expect(page.getByText('Products')).toBeVisible();
  });

  test('stock status filter tabs visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products');
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'In stock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Low stock' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Out of stock' })).toBeVisible();
  });

  test('search input is visible', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products');
    await expect(page.getByPlaceholder(/search name or sku/i)).toBeVisible();
  });
});

test.describe('Create product', () => {
  test('create product form loads', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products/new');
    await expect(page.getByText('Add product')).toBeVisible();
    await expect(page.getByPlaceholder('Kerastase Shampoo 250ml')).toBeVisible();
  });

  test('variant toggle switches the form', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products/new');
    // Check the "Has variants" checkbox
    await page.getByText('Has variants').click();
    // MRP field should disappear, variant section should appear
    await expect(page.getByPlaceholder('S / 250ml / Red')).toBeVisible({ timeout: 2000 });
  });

  test('submit with no name shows error', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products/new');
    await page.getByRole('button', { name: /add product/i }).click();
    await expect(page.locator('.form-error').first()).toBeVisible({ timeout: 3000 });
  });

  test('Add variant button adds a new row', async ({ vendorPage: page }) => {
    await page.goto('/dashboard/inventory/products/new');
    await page.getByText('Has variants').click();
    const before = await page.getByPlaceholder('S / 250ml / Red').count();
    await page.getByRole('button', { name: /add variant/i }).click();
    const after = await page.getByPlaceholder('S / 250ml / Red').count();
    expect(after).toBe(before + 1);
  });
});
