// src/inngest/functions/bookingReminder.ts
//
// Booking reminder job — runs daily at 09:00 IST (03:30 UTC).
// Finds all CONFIRMED bookings scheduled for tomorrow across all tenants
// and creates an in-app Notification for the customer and the assigned staff.
//
// This replaces manual reminder logic and the previously un-used
// Booking.reminderSent boolean field.

import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';

export const bookingReminderFunction = inngest.createFunction(
  {
    id:   'booking-reminder-daily',
    name: 'Daily booking reminders',
    // Concurrency: only one instance at a time — prevents duplicate reminders
    // if the function is retried after a partial failure.
    concurrency: { limit: 1 },
  },
  // Run at 03:30 UTC daily — 09:00 IST
  { cron: '30 3 * * *' },

  async ({ step }) => {
    // ── Step 1: Compute tomorrow's date string ────────────────────────
    const tomorrow = await step.run('compute-tomorrow', () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    });

    // ── Step 2: Find bookings needing a reminder ──────────────────────
    const bookings = await step.run('find-bookings', async () => {
      return prisma.booking.findMany({
        where: {
          date:         tomorrow,
          status:       'CONFIRMED',
          reminderSent: false,
        },
        include: {
          customer: { select: { id: true, name: true } },
          staff:    { include: { user: { select: { id: true, name: true } } } },
          services: { include: { service: { select: { name: true } } } },
          tenant:   { select: { name: true } },
        },
      });
    });

    if (bookings.length === 0) {
      return { reminded: 0, date: tomorrow };
    }

    // ── Step 3: Create notifications in batch ────────────────────────
    const reminded = await step.run('create-notifications', async () => {
      const notifications = bookings.flatMap(b => {
        const serviceNames = b.services.map(bs => bs.service.name).join(', ');
        const timeStr      = b.startTime;

        const customerNotif = {
          tenantId: b.tenantId,
          userId:   b.customerId,
          type:     'NEW_BOOKING',
          title:    'Appointment tomorrow',
          message:  `Your ${serviceNames} appointment is tomorrow at ${timeStr}. See you at ${b.tenant.name}!`,
        };

        const staffNotif = b.staff ? {
          tenantId: b.tenantId,
          userId:   b.staff.userId,
          type:     'NEW_BOOKING',
          title:    'Appointment reminder',
          message:  `${b.customer.name} has a ${serviceNames} appointment tomorrow at ${timeStr}.`,
        } : null;

        return staffNotif ? [customerNotif, staffNotif] : [customerNotif];
      });

      await prisma.notification.createMany({ data: notifications });

      // Mark reminders as sent (bulk update per booking id batch)
      await prisma.booking.updateMany({
        where: { id: { in: bookings.map(b => b.id) } },
        data:  { reminderSent: true },
      });

      return notifications.length;
    });

    return { reminded, bookingsProcessed: bookings.length, date: tomorrow };
  }
);
