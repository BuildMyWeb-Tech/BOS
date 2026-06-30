// src/app/api/reports/inventory/route.ts
// GET /api/reports/inventory?deadStockDays=
//
// Stock valuation: sum of (unit price * quantity on hand) across all
// products — uses variant prices where present, else Product.mrp.
// Dead stock: products with quantity > 0 but no BillItem/OrderItem sale
// in the last `deadStockDays` days (or never sold at all).
//
// Permission: report.view, requires inventory module conceptually but
// not module-gated here since reports are a cross-cutting concern —
// returns empty/zero data gracefully if inventory is unused.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { inventoryReportQuerySchema, validate } from '@/lib/validation';
import { classifyStockStatus } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('report.view');
    if (!canView) return forbidden('Missing permission: report.view');

    const { searchParams } = request.nextUrl;
    const { data, errors } = validate(inventoryReportQuerySchema, {
      deadStockDays: searchParams.get('deadStockDays') ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;

    const products = await prisma.product.findMany({
      where: { tenantId, isDeleted: false },
      include: {
        inventory: { where: { tenantId }, select: { quantity: true, lowStock: true } },
        variants:  { select: { id: true, price: true, stock: true } },
      },
    });

    let totalStockValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const productSummaries = products.map(p => {
      const hasVariants = p.variants.length > 0;
      const quantity = hasVariants
        ? p.variants.reduce((sum, v) => sum + v.stock, 0)
        : (p.inventory[0]?.quantity ?? 0);
      const lowStockThreshold = p.inventory[0]?.lowStock ?? 10;

      const value = hasVariants
        ? p.variants.reduce((sum, v) => sum + v.price * v.stock, 0)
        : p.mrp * quantity;

      totalStockValue += value;

      const status = classifyStockStatus(quantity, lowStockThreshold);
      if (status === 'low_stock') lowStockCount += 1;
      if (status === 'out_of_stock') outOfStockCount += 1;

      return { productId: p.id, productName: p.name, quantity };
    });

    // Dead stock: in-stock products with no sale activity in the window
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (data.deadStockDays ?? 90));


    const inStockProducts = productSummaries.filter(p => p.quantity > 0);

    const deadStock = [];
    for (const p of inStockProducts) {
      const [recentBillSale, recentOrderSale] = await Promise.all([
        prisma.billItem.findFirst({
          where: { productId: p.productId, bill: { tenantId, createdAt: { gte: cutoff } } },
          select: { id: true },
        }),
        prisma.orderItem.findFirst({
          where: { productId: p.productId, order: { tenantId, createdAt: { gte: cutoff }, status: { not: 'CANCELLED' } } },
          select: { productId: true },
        }),
      ]);

      if (!recentBillSale && !recentOrderSale) {
        const lastBill = await prisma.billItem.findFirst({
          where: { productId: p.productId, bill: { tenantId } },
          orderBy: { bill: { createdAt: 'desc' } },
          select: { bill: { select: { createdAt: true } } },
        });
        const lastOrder = await prisma.orderItem.findFirst({
          where: { productId: p.productId, order: { tenantId } },
          orderBy: { order: { createdAt: 'desc' } },
          select: { order: { select: { createdAt: true } } },
        });

        const lastBillDate  = lastBill?.bill.createdAt ?? null;
        const lastOrderDate = lastOrder?.order.createdAt ?? null;
        const lastSaleDate =
          lastBillDate && lastOrderDate
            ? (lastBillDate > lastOrderDate ? lastBillDate : lastOrderDate)
            : (lastBillDate ?? lastOrderDate);

        deadStock.push({
          productId:    p.productId,
          productName:  p.productName,
          quantity:     p.quantity,
          lastSaleDate: lastSaleDate ? lastSaleDate.toISOString() : null,
        });
      }
    }

    return ok({
      report: {
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        lowStockCount,
        outOfStockCount,
        deadStock,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
