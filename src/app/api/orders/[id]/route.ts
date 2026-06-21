// src/app/api/orders/[id]/route.ts
// GET /api/orders/[id] — full order detail with timeline
//
// Customer can only view their own orders; staff/owner with orders.view
// can view any order in the tenant.

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        user:       { select: { name: true } },
        address:    true,
        orderItems: { include: { product: { select: { name: true } } } },
        timeline:   { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) return notFound('Order');

    const isOwnOrder = order.userId === auth.userId;
    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('orders.view');

    if (!isOwnOrder && !isPrivileged) {
      return forbidden('You do not have permission to view this order');
    }

    const couponData = order.coupon as { code?: string; discount?: number } | null;

    return ok({
      order: {
        id:            order.id,
        tenantId:      order.tenantId,
        userId:        order.userId,
        customerName:  order.user.name,
        addressId:     order.addressId,
        address: {
          id: order.address.id, name: order.address.name, email: order.address.email,
          street: order.address.street, city: order.address.city, state: order.address.state,
          zip: order.address.zip, country: order.address.country, phone: order.address.phone,
          createdAt: order.address.createdAt,
        },
        total:         order.total,
        status:        order.status,
        isPaid:        order.isPaid,
        paymentMethod: order.paymentMethod,
        isCouponUsed:  order.isCouponUsed,
        couponCode:    couponData?.code ?? null,
        items: order.orderItems.map(i => ({
          productId:   i.productId,
          productName: i.product.name,
          quantity:    i.quantity,
          price:       i.price,
          lineTotal:   Math.round(i.price * i.quantity * 100) / 100,
        })),
        timeline: order.timeline.map(t => ({
          id: t.id, status: t.status, changedBy: t.changedBy, note: t.note, createdAt: t.createdAt,
        })),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
