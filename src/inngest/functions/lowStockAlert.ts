// src/inngest/functions/lowStockAlert.ts
//
// Low-stock alert job — triggered by 'inventory/low-stock.check' events
// fired after every bill creation and stock adjustment.
//
// Finds all VENDOR_OWNER users for the tenant and creates a LOW_STOCK
// in-app notification. Deduplicated: if an unread low-stock notification
// for the same product already exists we skip creating a duplicate.

import { inngest } from '@/inngest/client';
import prisma from '@/lib/prisma';

export const lowStockAlertFunction = inngest.createFunction(
  {
    id:   'low-stock-alert',
    name: 'Low stock alert notification',
    // Debounce: if the same product fires multiple events within 5 minutes
    // (e.g. rapid POS sales), only process one notification.
    debounce: {
      key:    'event.data.productId',
      period: '5m',
    },
  },
  { event: 'inventory/low-stock.check' },

  async ({ event, step }) => {
    const { tenantId, productId, quantity, lowStock, productName } = event.data;

    // Only alert if quantity is still at or below threshold
    // (could have been restocked between event firing and job execution)
    const current = await step.run('check-current-quantity', async () => {
      return prisma.inventory.findUnique({
        where:  { productId_tenantId: { productId, tenantId } },
        select: { quantity: true },
      });
    });

    if (!current || current.quantity > lowStock) {
      return { skipped: true, reason: 'Stock restored before job ran' };
    }

    // Check for existing unread notification to avoid spam
    const existing = await step.run('check-existing-notification', async () => {
      return prisma.notification.findFirst({
        where: {
          tenantId,
          type:    'LOW_STOCK',
          isRead:  false,
          message: { contains: productId },
        },
      });
    });

    if (existing) {
      return { skipped: true, reason: 'Unread notification already exists' };
    }

    // Find all vendor owner users for this tenant
    const owners = await step.run('find-owners', async () => {
      return prisma.user.findMany({
        where: {
          tenantId,
          isActive:  true,
          userRoles: {
            some: {
              role: { name: 'VENDOR_OWNER' },
            },
          },
        },
        select: { id: true },
      });
    });

    if (owners.length === 0) {
      return { skipped: true, reason: 'No active vendor owners found' };
    }

    await step.run('create-notifications', async () => {
      const statusText = quantity === 0 ? 'is out of stock' : `is running low (${quantity} left)`;
      await prisma.notification.createMany({
        data: owners.map(owner => ({
          tenantId,
          userId:   owner.id,
          type:     'LOW_STOCK',
          title:    quantity === 0 ? 'Out of stock' : 'Low stock alert',
          message:  `${productName} ${statusText}. Restock soon to avoid missing sales. [productId:${productId}]`,
        })),
      });
    });

    return {
      notified:    owners.length,
      productName,
      quantity,
      lowStock,
    };
  }
);
