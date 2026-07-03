// src/lib/events.ts
//
// Fire-and-forget event helpers for routes that trigger background jobs.
// Each function sends an Inngest event and swallows errors — a failed
// event dispatch should never break the primary HTTP response.
//
// Usage:
//   import { fireVendorApproved } from '@/lib/events';
//   await fireVendorApproved({ tenantId, tenantName, ownerEmail, ownerName });

import { inngest } from '@/inngest/client';

// ── Safe wrapper ──────────────────────────────────────────────────
async function safeFireEvent(name: string, data: Record<string, unknown>): Promise<void> {
  try {
    await inngest.send({ name, data } as Parameters<typeof inngest.send>[0]);
  } catch (err) {
    // Non-fatal — log and continue. The primary operation already succeeded.
    console.warn(`[events] Failed to fire ${name}:`, err);
  }
}

// ── Vendor onboarding ─────────────────────────────────────────────

export async function fireVendorApproved(data: {
  tenantId:   string;
  tenantName: string;
  ownerEmail: string;
  ownerName:  string;
}): Promise<void> {
  await safeFireEvent('vendor/approved', data);
}

export async function fireVendorRejected(data: {
  tenantId:   string;
  tenantName: string;
  ownerEmail: string;
  ownerName:  string;
  reason:     string;
}): Promise<void> {
  await safeFireEvent('vendor/rejected', data);
}

// ── Booking ───────────────────────────────────────────────────────

export async function fireBookingCreated(data: {
  bookingId:   string;
  tenantId:    string;
  customerId:  string;
  date:        string;
  startTime:   string;
  totalAmount: number;
  services:    string[];
}): Promise<void> {
  await safeFireEvent('booking/created', data);
}

export async function fireBookingStatusChanged(data: {
  bookingId: string;
  tenantId:  string;
  oldStatus: string;
  newStatus: string;
}): Promise<void> {
  await safeFireEvent('booking/status.changed', data);
}

// ── Inventory ─────────────────────────────────────────────────────

export async function fireLowStockCheck(data: {
  tenantId:    string;
  productId:   string;
  quantity:    number;
  lowStock:    number;
  productName: string;
}): Promise<void> {
  // Only fire if quantity is at or below threshold
  if (data.quantity <= data.lowStock) {
    await safeFireEvent('inventory/low-stock.check', data);
  }
}
