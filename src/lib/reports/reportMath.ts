// src/lib/reports/reportMath.ts
//
// Pure functions for report aggregation math. No DB calls — route
// handlers fetch raw rows (each with at least { createdAt, amount }-ish
// shape) and pass them through these functions to bucket/summarize.

import type { ReportBucket } from '@/types';

/**
 * Compute the bucket label for a given date under a given bucket size.
 *   day:   "YYYY-MM-DD"
 *   week:  "YYYY-Www" (ISO week number, Monday-start)
 *   month: "YYYY-MM"
 */
export function getBucketLabel(date: Date, bucket: ReportBucket): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  if (bucket === 'day') return `${yyyy}-${mm}-${dd}`;
  if (bucket === 'month') return `${yyyy}-${mm}`;

  // ISO week number (Monday-start, week containing the first Thursday of
  // the year is week 1) — standard ISO 8601 algorithm.
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = (target.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Generate the ordered sequence of bucket labels spanning [from, to]
 * inclusive, so a report can show zero-value buckets for days/weeks/months
 * with no activity rather than silently omitting them.
 */
export function generateBucketSequence(from: string, to: string, bucket: ReportBucket): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  const cursor = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');

  while (cursor <= end) {
    const label = getBucketLabel(cursor, bucket);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return labels;
}

/**
 * Group a list of dated amounts into buckets, summing each bucket.
 * Returns a Map so callers can merge multiple sources (booking/billing/order)
 * into the same bucket keys before flattening into report rows.
 */
export function bucketAmounts(
  rows: Array<{ date: Date; amount: number }>,
  bucket: ReportBucket
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const label = getBucketLabel(row.date, bucket);
    result.set(label, (result.get(label) ?? 0) + row.amount);
  }
  return result;
}

/**
 * Compute percent growth between two totals.
 * Returns null when there's no meaningful prior-period baseline (previous = 0),
 * since "infinite growth" or division-by-zero is not a useful number to show.
 */
export function calculateGrowthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100; // 2dp percent
}

/**
 * Compute average order/transaction value, safely handling zero transactions
 * (returns 0 instead of NaN/Infinity).
 */
export function calculateAverageValue(totalRevenue: number, transactionCount: number): number {
  if (transactionCount === 0) return 0;
  return Math.round((totalRevenue / transactionCount) * 100) / 100;
}

/**
 * Rank a list of {id, name, quantity, revenue} items by revenue descending,
 * returning the top N. Pure sort+slice, but centralized so every "top X"
 * report uses identical tie-breaking (by name ascending as a secondary key,
 * for deterministic output when revenues are equal).
 */
export function rankTopItems<T extends { revenue: number; name: string }>(
  items: T[],
  limit: number
): T[] {
  return [...items]
    .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
    .slice(0, limit);
}
