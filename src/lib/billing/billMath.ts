// src/lib/billing/billMath.ts
//
// Pure functions for billing math. No DB, no side effects.

export interface TaxSettings {
  taxType:    'SINGLE' | 'SPLIT';
  taxPercent: number; // used when taxType === 'SINGLE'
  cgst:       number; // used when taxType === 'SPLIT'
  sgst:       number; // used when taxType === 'SPLIT'
}

export interface TaxBreakdown {
  taxAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
}

/**
 * Compute tax on a given taxable amount per the tenant's configured tax type.
 * SINGLE: one flat taxPercent applied to the whole amount.
 * SPLIT:  cgst% + sgst% each applied to the amount (India-style GST split),
 *         summed into a single taxAmount but reported separately too.
 *
 * Rounds to 2 decimal places to avoid floating point drift in money math.
 */
export function calculateTax(taxableAmount: number, settings: TaxSettings): TaxBreakdown {
  if (taxableAmount <= 0) {
    return settings.taxType === 'SPLIT'
      ? { taxAmount: 0, cgstAmount: 0, sgstAmount: 0 }
      : { taxAmount: 0 };
  }

  if (settings.taxType === 'SPLIT') {
    const cgstAmount = round2(taxableAmount * (settings.cgst / 100));
    const sgstAmount = round2(taxableAmount * (settings.sgst / 100));
    return { taxAmount: round2(cgstAmount + sgstAmount), cgstAmount, sgstAmount };
  }

  const taxAmount = round2(taxableAmount * (settings.taxPercent / 100));
  return { taxAmount };
}

/**
 * Compute the total for a single bill line item:
 *   (unitPrice * quantity) - lineDiscount
 * Never allowed to go negative (a discount larger than the line value
 * is clamped to zero, not a negative total).
 */
export function calculateLineTotal(unitPrice: number, quantity: number, lineDiscount: number): number {
  const gross = unitPrice * quantity;
  const net = gross - lineDiscount;
  return round2(Math.max(0, net));
}

/**
 * Full bill total computation:
 *   subtotal = sum of all line totals (post line-discount)
 *   taxableAmount = subtotal - billDiscount (bill-level discount applied before tax)
 *   taxAmount = calculateTax(taxableAmount, settings)
 *   total = taxableAmount + taxAmount
 *
 * billDiscount is clamped so it can never exceed the subtotal (no negative taxable amount).
 */
export interface BillTotals {
  subtotal:        number;
  effectiveDiscount: number; // billDiscount actually applied (post-clamp)
  taxableAmount:   number;
  taxAmount:       number;
  cgstAmount?:     number;
  sgstAmount?:     number;
  total:           number;
}

export function calculateBillTotals(
  lineTotals: number[],
  billDiscount: number,
  taxSettings: TaxSettings
): BillTotals {
  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));
  const effectiveDiscount = round2(Math.min(billDiscount, subtotal));
  const taxableAmount = round2(subtotal - effectiveDiscount);

  const tax = calculateTax(taxableAmount, taxSettings);
  const total = round2(taxableAmount + tax.taxAmount);

  return {
    subtotal,
    effectiveDiscount,
    taxableAmount,
    taxAmount: tax.taxAmount,
    ...(tax.cgstAmount !== undefined && { cgstAmount: tax.cgstAmount }),
    ...(tax.sgstAmount !== undefined && { sgstAmount: tax.sgstAmount }),
    total,
  };
}

/**
 * Compute change due for a cash payment.
 * Returns 0 if paidAmount <= total (no change, or insufficient payment —
 * insufficiency is a separate validation concern, not this function's job).
 */
export function calculateChange(total: number, paidAmount: number): number {
  return round2(Math.max(0, paidAmount - total));
}

/**
 * Generate a bill number in the form INV-YYYYMMDD-NNN, where NNN is a
 * zero-padded sequential counter for that tenant+day (3 digits, rolling
 * over to 4+ digits naturally past 999 since it's just String(n)).
 *
 * The counter itself must be supplied by the caller (a same-day count
 * query against the DB) — this function only formats it.
 */
export function generateBillNumber(date: Date, dailySequence: number): string {
  const yyyy = date.getFullYear();
  const mm   = String(date.getMonth() + 1).padStart(2, '0');
  const dd   = String(date.getDate()).padStart(2, '0');
  const seq  = String(dailySequence).padStart(3, '0');
  return `INV-${yyyy}${mm}${dd}-${seq}`;
}

// ─── Internal helper ───────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
