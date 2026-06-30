// src/app/api/reports/sales-summary/route.ts
// GET /api/reports/sales-summary?from=&to=&limit=
//
// Top products: aggregated from BillItem + OrderItem (both reference Product).
// Top services: aggregated from BookingService.
// Transactions: count of Bill + Order + completed/confirmed Booking rows.
//
// Permission: report.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { salesSummaryQuerySchema, validate } from '@/lib/validation';
import { calculateAverageValue, rankTopItems } from '@/lib/reports/reportMath';
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
    const { data, errors } = validate(salesSummaryQuerySchema, {
      from:  searchParams.get('from'),
      to:    searchParams.get('to'),
      limit: searchParams.get('limit') ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;
    const fromDate = new Date(`${data.from}T00:00:00`);
    const toDate   = new Date(`${data.to}T23:59:59`);

    const [billItems, orderItems, bookingServices, billCount, orderCount, bookingCount, billRevenue, orderRevenue, bookingRevenue] =
      await Promise.all([
        prisma.billItem.findMany({
          where: { bill: { tenantId, createdAt: { gte: fromDate, lte: toDate } } },
          select: { productId: true, name: true, quantity: true, total: true },
        }),
        prisma.orderItem.findMany({
          where: { order: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } } },
          select: { productId: true, quantity: true, price: true, product: { select: { name: true } } },
        }),
        prisma.bookingService.findMany({
          where: { booking: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { in: ['CONFIRMED', 'COMPLETED'] } } },
          select: { serviceId: true, price: true, service: { select: { name: true } } },
        }),
        prisma.bill.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.order.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } } }),
        prisma.booking.count({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
        prisma.bill.aggregate({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate } }, _sum: { total: true } }),
        prisma.order.aggregate({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
        prisma.booking.aggregate({ where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { in: ['CONFIRMED', 'COMPLETED'] } }, _sum: { totalAmount: true } }),
      ]);

    // Aggregate products by productId across both Bill and Order lines
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const item of billItems) {
      const existing = productMap.get(item.productId) ?? { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue  += item.total;
      productMap.set(item.productId, existing);
    }
    for (const item of orderItems) {
      const existing = productMap.get(item.productId) ?? { name: item.product.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue  += Math.round(item.price * item.quantity * 100) / 100;
      productMap.set(item.productId, existing);
    }

    const topProducts = rankTopItems(
      Array.from(productMap.entries()).map(([id, v]) => ({ id, ...v })),
       data.limit ?? 10

    );

    // Aggregate services
    const serviceMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const bs of bookingServices) {
      const existing = serviceMap.get(bs.serviceId) ?? { name: bs.service.name, quantity: 0, revenue: 0 };
      existing.quantity += 1;
      existing.revenue  += bs.price;
      serviceMap.set(bs.serviceId, existing);
    }

    const topServices = rankTopItems(
      Array.from(serviceMap.entries()).map(([id, v]) => ({ id, ...v })),
      data.limit ?? 10
    );

    const totalTransactions = billCount + orderCount + bookingCount;
    const totalRevenue =
      (billRevenue._sum.total ?? 0) + (orderRevenue._sum.total ?? 0) + (bookingRevenue._sum.totalAmount ?? 0);

    return ok({
      report: {
        from: data.from,
        to:   data.to,
        totalTransactions,
        averageOrderValue: calculateAverageValue(totalRevenue, totalTransactions),
        topProducts,
        topServices,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
