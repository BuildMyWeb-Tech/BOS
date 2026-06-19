// src/lib/inventory/stockSync.ts
//
// Pure functions for inventory math — no DB calls.
// The actual DB sync (recomputing Inventory.quantity from ProductBatch
// rows after a write) lives in the route handlers since it requires a
// transaction; these helpers are the parts worth unit testing in isolation.

import type { StockStatus } from '@/types';

/**
 * Classify a stock quantity against the configured low-stock threshold.
 *
 *   0                      -> out_of_stock
 *   1..lowStockThreshold   -> low_stock
 *   > lowStockThreshold    -> in_stock
 */
export function classifyStockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Sum remainingQty across a set of batches. Used both for whole-product
 * totals (all batches) and per-variant totals (batches filtered by variantId).
 */
export function sumRemainingQuantity(batches: Array<{ remainingQty: number }>): number {
  return batches.reduce((sum, b) => sum + b.remainingQty, 0);
}

/**
 * Apply a manual adjustment delta to a current quantity, never allowing
 * the result to go negative (a removal larger than what's on hand is
 * clamped at zero rather than producing a nonsensical negative count).
 */
export function applyAdjustment(currentQuantity: number, delta: number): number {
  const result = currentQuantity + delta;
  return Math.max(0, result);
}

/**
 * Determine how much of a requested deduction quantity each batch should
 * absorb, in FEFO order (batches should be pre-sorted: earliest expiry
 * first, nulls last, then oldest createdAt as tiebreak — sorting itself
 * happens at the query level since it needs DB ordering).
 *
 * Returns a list of { batchId, deduct } describing how much to subtract
 * from each batch's remainingQty, plus any quantity that could NOT be
 * fulfilled (shortfall > 0 means insufficient total stock).
 */
export interface FefoBatch {
  id:           string;
  remainingQty: number;
}

export interface FefoDeduction {
  batchId: string;
  deduct:  number;
}

export function allocateFefoDeduction(
  batches: FefoBatch[],
  requestedQty: number
): { deductions: FefoDeduction[]; shortfall: number } {
  const deductions: FefoDeduction[] = [];
  let remaining = requestedQty;

  for (const batch of batches) {
    if (remaining <= 0) break;
    if (batch.remainingQty <= 0) continue;

    const take = Math.min(batch.remainingQty, remaining);
    deductions.push({ batchId: batch.id, deduct: take });
    remaining -= take;
  }

  return { deductions, shortfall: Math.max(0, remaining) };
}
