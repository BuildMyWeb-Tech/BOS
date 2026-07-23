// src/app/api/storefront/orders/[orderId]/route.ts
// GET — public order detail. No auth needed.
// Security: order ID is unguessable CUID + tenant validated from slug.

import { NextRequest } from 'next/server';
import { ok, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ orderId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { orderId } = await params;
    const slug = request.headers.get('x-tenant-slug') ?? request.nextUrl.searchParams.get('slug');

    let tenantId: string | undefined;
    if (slug) {
      const tenant = await prisma.tenant.findFirst({
        where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
        select: { id: true },
      });
      if (tenant) tenantId = tenant.id;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, ...(tenantId ? { tenantId } : {}) },
      include: {
        user:          { select: { name: true, email: true } },
        address:       true,
        orderItems:    { include: { product: { select: { name: true } } } },
        orderTimeline: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) return notFound('Order');

    return ok({
      order: {
        id:            order.id,
        total:         order.total,
        status:        order.status,
        isPaid:        order.isPaid,
        paymentMethod: order.paymentMethod,
        isCouponUsed:  order.isCouponUsed,
        createdAt:     order.createdAt,
        updatedAt:     order.updatedAt,
        customerName:  order.user.name,
        address: order.address ? {
          name:    order.address.name,
          street:  order.address.street,
          city:    order.address.city,
          state:   order.address.state,
          zip:     order.address.zip,
          country: order.address.country,
          phone:   order.address.phone,
        } : null,
        items: order.orderItems.map(i => ({
          productId:   i.productId,
          productName: i.product.name,
          quantity:    i.quantity,
          price:       i.price,
          lineTotal:   i.price * i.quantity,
        })),
        timeline: order.orderTimeline.map(t => ({
          id:        t.id,
          status:    t.status,
          changedBy: t.changedBy,
          note:      t.note,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error) {
    return serverError(error);
  }
}