// src/inngest/functions/vendorOnboarding.ts
//
// Vendor onboarding notifications:
//   - vendor/approved  → welcome in-app notification + (future: email)
//   - vendor/rejected  → rejection in-app notification with reason

import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';

// ── Approval notification ─────────────────────────────────────────

export const vendorApprovedFunction = inngest.createFunction(
  { id: 'vendor-approved-notification', name: 'Vendor approved — welcome notification' },
  { event: 'vendor/approved' },

  async ({ event, step }) => {
    const { tenantId, tenantName, ownerName } = event.data;

    // Find the VENDOR_OWNER user for this tenant
    const owner = await step.run('find-owner', async () => {
      return prisma.user.findFirst({
        where: {
          tenantId,
          isActive:  true,
          userRoles: { some: { role: { name: 'VENDOR_OWNER' } } },
        },
        select: { id: true },
      });
    });

    if (!owner) return { skipped: true, reason: 'No vendor owner found' };

    await step.run('create-welcome-notification', async () => {
      await prisma.notification.create({
        data: {
          tenantId,
          userId:  owner.id,
          type:    'VENDOR_APPROVED',
          title:   'Your business is approved! 🎉',
          message: `Welcome to BOS, ${ownerName}! Your business "${tenantName}" has been approved. ` +
                   `Start by configuring your services, slot schedule, and staff in the dashboard.`,
        },
      });
    });

    // Future: send email via a transactional email provider
    // await step.run('send-welcome-email', async () => { ... });

    return { notified: true, tenantId, ownerName };
  }
);

// ── Rejection notification ────────────────────────────────────────

export const vendorRejectedFunction = inngest.createFunction(
  { id: 'vendor-rejected-notification', name: 'Vendor rejected — notification with reason' },
  { event: 'vendor/rejected' },

  async ({ event, step }) => {
    const { tenantId, tenantName, ownerName, reason } = event.data;

    const owner = await step.run('find-owner', async () => {
      return prisma.user.findFirst({
        where: {
          tenantId,
          userRoles: { some: { role: { name: 'VENDOR_OWNER' } } },
        },
        select: { id: true },
      });
    });

    if (!owner) return { skipped: true, reason: 'No vendor owner found' };

    await step.run('create-rejection-notification', async () => {
      await prisma.notification.create({
        data: {
          tenantId,
          userId:  owner.id,
          type:    'SYSTEM',
          title:   'Application update for ' + tenantName,
          message: `Hi ${ownerName}, your application for "${tenantName}" could not be approved at this time. ` +
                   `Reason: ${reason}. Please reapply once the issue is resolved.`,
        },
      });
    });

    return { notified: true, tenantId, ownerName };
  }
);
