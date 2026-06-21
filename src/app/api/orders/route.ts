// src/app/api/orders/route.ts
// GET  /api/orders — list orders (customer sees own; staff/owner see tenant's)
// POST /api/orders — checkout: converts the customer's cart into an Order
//
// POST flow:
//   1. Load cart — must be non-empty
//   2. Validate address belongs to customer
//   3. Resolve coupon if provided (reuses checkCouponEligibility)
//   4. For each cart line: resolve unit price, check FEFO stock sufficiency
//      (fail fast — no partial orders, same pattern as Phase 6 billing)
//   5. Transaction: create Order + OrderItem rows, deduct stock across
//      ProductBatch/Inventory/ProductVariant, write initial OrderTimeline
//      entry, clear the cart
//
// NOTE: OrderItem has no variantId column (@@id([orderId, productId])) —
// only one line per product per order is possible. If the same product
// appears in the cart with two different variants, checkout rejects with
// a clear error rather than silently merging or dropping one.

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

// ─── GET /api/orders ────────────────────────────────────────────────

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

// ─── POST /api/orders (checkout) ───────────────────────────────────

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

    // Validate address belongs to this customer
    const address = await prisma.address.findFirst({
      where: { id: data.addressId, userId: auth.userId, tenantId },
    });
    if (!address) return badRequest('Address not found');

    // Load cart
    const cart = await prisma.cart.findUnique({
      where: { userId: auth.userId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) {
      return badRequest('Cart is empty');
    }

    // Reject duplicate product with different variants — OrderItem schema
    // can only hold one line per productId per order.
    const productIds = cart.items.map(i => i.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      return badRequest(
        'Your cart has multiple entries for the same product with different variants — please remove duplicates before checkout'
      );
    }

    // Resolve each line: unit price + FEFO batch plan
    interface ResolvedLine {
      productId:   string;
      variantId:   string | null;
      unitPrice:   number;
      quantity:    number;
      lineTotal:   number;
      deductions:  { batchId: string; deduct: number }[];
    }

    const resolvedLines: ResolvedLine[] = [];
    const stockErrors: string[] = [];

    for (const item of cart.items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, tenantId, isDeleted: false },
      });
      if (!product) {
        stockErrors.push(`Product ${item.productId} no longer available`);
        continue;
      }

      let unitPrice = product.mrp;
      if (item.variantId) {
        const variant = await prisma.productVariant.findFirst({
          where: { id: item.variantId, productId: item.productId },
        });
        if (!variant) {
          stockErrors.push(`A selected variant for "${product.name}" is no longer available`);
          continue;
        }
        unitPrice = variant.price;
      }

      const batches = await prisma.productBatch.findMany({
        where: {
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : { variantId: null }),
          remainingQty: { gt: 0 },
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, remainingQty: true },
      });

      const fefoBatches: FefoBatch[] = batches.map(b => ({ id: b.id, remainingQty: b.remainingQty }));
      const { deductions, shortfall } = allocateFefoDeduction(fefoBatches, item.quantity);

      if (shortfall > 0) {
        stockErrors.push(`Insufficient stock for "${product.name}" — short by ${shortfall} unit(s)`);
        continue;
      }

      resolvedLines.push({
        productId: item.productId,
        variantId: item.variantId,
        unitPrice,
        quantity:  item.quantity,
        lineTotal: calculateOrderLineTotal(unitPrice, item.quantity),
        deductions,
      });
    }

    if (stockErrors.length > 0) {
      return badRequest('Cannot complete checkout', { items: stockErrors });
    }

    // Resolve coupon, if provided
    let couponDiscount = 0;
    let couponSnapshot: Record<string, unknown> = {};
    const subtotalBeforeCoupon = resolvedLines.reduce((sum, l) => sum + l.lineTotal, 0);

    if (data.couponCode) {
      let coupon = await prisma.coupon.findFirst({ where: { code: data.couponCode, tenantId } });
      if (!coupon) coupon = await prisma.coupon.findFirst({ where: { code: data.couponCode, tenantId: null } });

      if (!coupon) return badRequest('Coupon code not found');

      const priorOrderCount = await prisma.order.count({
        where: { userId: auth.userId, tenantId, status: { not: 'CANCELLED' } },
      });

      const eligibility = checkCouponEligibility({
        code: coupon.code, discount: coupon.discount,
        forNewUser: coupon.forNewUser, forMember: coupon.forMember, isPublic: coupon.isPublic,
        expiresAt: coupon.expiresAt, now: new Date(),
        isNewCustomer: priorOrderCount === 0, isMember: false,
        cartTotal: subtotalBeforeCoupon,
      });

      if (!eligibility.valid) {
        return badRequest(eligibility.reason ?? 'Coupon is not valid');
      }

      couponDiscount = coupon.discount;
      couponSnapshot = { code: coupon.code, discount: coupon.discount };
    }

    const total = calculateOrderTotal(resolvedLines.map(l => l.lineTotal), couponDiscount);

    // Transaction: create Order + OrderItems, deduct stock, write timeline, clear cart
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          userId:        auth.userId,
          addressId:     data.addressId,
          total,
          status:        'ORDER_PLACED',
          isPaid:        data.paymentMethod !== 'COD',
          paymentMethod: data.paymentMethod,
          isCouponUsed:  !!data.couponCode,
          coupon:        couponSnapshot,
        },
      });

      for (const line of resolvedLines) {
        await tx.orderItem.create({
          data: {
            orderId:   created.id,
            productId: line.productId,
            quantity:  line.quantity,
            price:     line.unitPrice,
          },
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
        data: {
          orderId:   created.id,
          status:    'ORDER_PLACED',
          changedBy: auth.userId,
          note:      'Order placed',
        },
      });

      await tx.sale.create({
        data: { tenantId, amount: total, source: 'ORDER', referenceId: created.id },
      });

      // Clear the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    return created(
      {
        order: {
          id:            order.id,
          total:         order.total,
          status:        order.status,
          isPaid:        order.isPaid,
          paymentMethod: order.paymentMethod,
          createdAt:     order.createdAt,
        },
      },
      'Order placed successfully'
    );
  } catch (error) {
    return serverError(error);
  }
}
