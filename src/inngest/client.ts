// src/inngest/client.ts
// Inngest client — one instance shared by all job functions.
// INNGEST_EVENT_KEY is set in .env.local (dev) and Vercel env (prod).

import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'bos',
  // In production Inngest reads INNGEST_EVENT_KEY from env automatically.
  // Explicitly passing it here keeps local dev working without extra config.
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// ── Typed event catalogue ─────────────────────────────────────────
// Every event BOS fires is listed here so all functions get full type safety.

export type BosEvents = {
  // Fired by the booking creation route after a booking is successfully saved
  'booking/created': {
    data: {
      bookingId:  string;
      tenantId:   string;
      customerId: string;
      date:       string; // "YYYY-MM-DD"
      startTime:  string; // "HH:MM"
      totalAmount: number;
      services:   string[]; // service names
    };
  };

  // Fired when a booking's status changes
  'booking/status.changed': {
    data: {
      bookingId: string;
      tenantId:  string;
      oldStatus: string;
      newStatus: string;
    };
  };

  // Fired after every inventory adjustment or bill creation
  'inventory/low-stock.check': {
    data: {
      tenantId:  string;
      productId: string;
      quantity:  number;
      lowStock:  number;
      productName: string;
    };
  };

  // Fired when a vendor is approved by Super Admin
  'vendor/approved': {
    data: {
      tenantId:    string;
      tenantName:  string;
      ownerEmail:  string;
      ownerName:   string;
    };
  };

  // Fired when a vendor is rejected
  'vendor/rejected': {
    data: {
      tenantId:    string;
      tenantName:  string;
      ownerEmail:  string;
      ownerName:   string;
      reason:      string;
    };
  };

  // Scheduled daily — checks for bookings needing reminders
  'booking/reminder.trigger': {
    data: Record<string, never>;
  };
};
