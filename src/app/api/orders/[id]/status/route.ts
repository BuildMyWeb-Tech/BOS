// src/app/api/orders/[id]/status/route.ts
// PATCH /api/orders/[id]/status — staff/owner updates order status
//
// Validates the transition against ORDER_TRANSITIONS (orderTransitions.ts),
// updates Order.status, and appends an OrderTimeline entry recording the
// change. isPaid is auto-flipped to true when status reaches DELIVERED
// for COD orders (payment collected on delivery).
//
// Permission: orders.manage

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { updateOrderStatusSchema, validate } from '@/lib/validation';
import { isValidOrderTransition, getAllowedNextStatuses } from '@/lib/ecommerce/orderTransitions';
import prisma from '@/lib/prisma';
import type { OrderStatus } from '@/types';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('orders.manage');
    if (!canManage) return forbidden('Missing permission: orders.manage');

    const { id } = await params;
    const order = await prisma.order.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!order) return notFound('Order');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateOrderStatusSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const currentStatus = order.status as OrderStatus;

    if (!isValidOrderTransition(currentStatus, data.status)) {
      const allowed = getAllowedNextStatuses(currentStatus);
      return badRequest(
        `Cannot transition from ${currentStatus} to ${data.status}. Allowed: ${allowed.join(', ') || 'none'}`
      );
    }

    const shouldMarkPaid = data.status === 'DELIVERED' && order.paymentMethod === 'COD';

    const [updated] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: {
          status: data.status,
          ...(shouldMarkPaid && { isPaid: true }),
        },
      }),
      prisma.orderTimeline.create({
        data: {
          orderId:   id,
          status:    data.status,
          changedBy: auth.userId,
          note:      data.note ?? null,
        },
      }),
    ]);

    return ok(
      { order: { id: updated.id, status: updated.status, isPaid: updated.isPaid } },
      `Order status updated to ${updated.status}`
    );
  } catch (error) {
    return serverError(error);
  }
}
