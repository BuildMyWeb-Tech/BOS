// src/app/api/orders/route.ts
// FIX P2028: Cart clear moved OUTSIDE the transaction.
// FIX: Transaction timeout raised to 25_000ms for Neon cold-start.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { checkoutSchema, orderListQuerySchema, validate } from '@/lib/validation';
import { allocateFefoDeduction, type FefoBatch } from '@/lib/inventory/stockSync';
import { checkCouponEligibility, calculateOrderLineTotal, calculateOrderTotal } from '@/lib/ecommerce/orderMath';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);

    const { data, errors } = validate(orderListQuerySchema, {
      status: searchParams.get('status') ?? undefined,
      from:   searchParams.get('from')   ?? undefined,
      to:     searchParams.get('to')     ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('orders.view');

    const where: Prisma.OrderWhereInput = {
      tenantId: auth.tenantId,
      ...(isPrivileged ? {} : { userId: auth.userId }),
      ...(data.status && { status: data.status }),
      ...(data.from && data.to && {
        createdAt: {
          gte: new Date(`${data.from}T00:00:00`),
          lte: new Date(`${data.to}T23:59:59`),
        },
      }),
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip:    paginationSkip(pagination),
        take:    pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user:       { select: { name: true } },
          orderItems: { select: { productId: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: orders.map(o => ({
        id:           o.id,
        customerName: o.user.name,
        total:        o.total,
        status:       o.status,
        isPaid:       o.isPaid,
        itemCount:    o.orderItems.length,
        createdAt:    o.createdAt,
      })),
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const tenantId = auth.tenantId;

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(checkoutSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const address = await prisma.address.findFirst({
      where: { id: data.addressId, userId: auth.userId, tenantId },
    });
    if (!address) return badRequest('Address not found');

    const cart = await prisma.cart.findUnique({
      where:   { userId: auth.userId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) return badRequest('Cart is empty');

    const productIds = cart.items.map(i => i.productId);
    if (new Set(productIds).size !== productIds.length) {
      return badRequest('Cart has duplicate products — remove duplicates before checkout');
    }

    interface ResolvedLine {
      productId:  string;
      variantId:  string | null;
      unitPrice:  number;
      quantity:   number;
      lineTotal:  number;
      deductions: { batchId: string; deduct: number }[];
    }

    const resolvedLines: ResolvedLine[] = [];
    const stockErrors:   string[]       = [];

    for (const item of cart.items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId, isDeleted: false },
      });
      if (!product) { stockErrors.push(`Product ${item.productId} unavailable`); continue; }

      let unitPrice = product.mrp;
      if (item.variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: { id: item.variantId, productId: item.productId },
        });
        if (!variant) { stockErrors.push(`Variant for "${product.name}" unavailable`); continue; }
        unitPrice = variant.price;
      }

      const batches = await prisma.productBatch.findMany({
        where:   { productId: item.productId, variantId: item.variantId ?? null, remainingQty: { gt: 0 } },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        select:  { id: true, remainingQty: true },
      });

      const { deductions, shortfall } = allocateFefoDeduction(
        batches.map<FefoBatch>(b => ({ id: b.id, remainingQty: b.remainingQty })),
        item.quantity,
      );
      if (shortfall > 0) { stockErrors.push(`Insufficient stock for "${product.name}"`); continue; }

      resolvedLines.push({
        productId: item.productId, variantId: item.variantId,
        unitPrice, quantity: item.quantity,
        lineTotal: calculateOrderLineTotal(unitPrice, item.quantity),
        deductions,
      });
    }

    if (stockErrors.length > 0) return badRequest('Cannot checkout', { items: stockErrors });

    let couponDiscount = 0;
    let couponSnapshot: Record<string, unknown> = {};
    const subtotal = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);

    if (data.couponCode) {
      const coupon =
        await prisma.coupon.findFirst({ where: { code: data.couponCode, tenantId } }) ??
        await prisma.coupon.findFirst({ where: { code: data.couponCode, tenantId: null } });
      if (!coupon) return badRequest('Coupon not found');

      const priorCount = await prisma.order.count({
        where: { userId: auth.userId, tenantId, status: { not: 'CANCELLED' } },
      });
      const eligibility = checkCouponEligibility({
        code: coupon.code, discount: coupon.discount,
        forNewUser: coupon.forNewUser, forMember: coupon.forMember, isPublic: coupon.isPublic,
        expiresAt: coupon.expiresAt, now: new Date(),
        isNewCustomer: priorCount === 0, isMember: false, cartTotal: subtotal,
      });
      if (!eligibility.valid) return badRequest(eligibility.reason ?? 'Coupon invalid');
      couponDiscount = coupon.discount;
      couponSnapshot = { code: coupon.code, discount: coupon.discount };
    }

    const total = calculateOrderTotal(resolvedLines.map(l => l.lineTotal), couponDiscount);

    // Transaction — cart clear intentionally OUTSIDE (prevents P2028 timeout)
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId,
          userId:        auth.userId,
          addressId:     data.addressId,
          total,
          status:        'ORDER_PLACED',
          isPaid:        data.paymentMethod !== 'COD',
          paymentMethod: data.paymentMethod,
          isCouponUsed:  !!data.couponCode,
          coupon:        couponSnapshot as Prisma.InputJsonValue,
        },
      });

      for (const line of resolvedLines) {
        await tx.orderItem.create({
          data: { orderId: newOrder.id, productId: line.productId, quantity: line.quantity, price: line.unitPrice },
        });
        for (const d of line.deductions) {
          await tx.productBatch.update({
            where: { id: d.batchId },
            data:  { remainingQty: { decrement: d.deduct } },
          });
        }
        await tx.inventory.update({
          where: { productId_tenantId: { productId: line.productId, tenantId } },
          data:  { quantity: { decrement: line.quantity } },
        });
        if (line.variantId) {
          await tx.productVariant.update({
            where: { id: line.variantId },
            data:  { stock: { decrement: line.quantity } },
          });
        }
      }

      await tx.orderTimeline.create({
        data: { orderId: newOrder.id, status: 'ORDER_PLACED', changedBy: auth.userId, note: 'Order placed' },
      });

      await tx.sale.create({
        data: { tenantId, amount: total, source: 'ORDER', referenceId: newOrder.id },
      });

      return newOrder;
    }, { timeout: 25_000 });

    // FIX: cart clear outside transaction — won't abort the order if slow
    try {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    } catch (e) {
      console.warn('[Orders] Cart clear failed (non-critical):', e);
    }

    return created(
      {
        order: {
          id: order.id, total: order.total, status: order.status,
          isPaid: order.isPaid, paymentMethod: order.paymentMethod, createdAt: order.createdAt,
        },
      },
      'Order placed successfully',
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return conflict('Duplicate order');
    }
    return serverError(error);
  }
}