// src/app/api/reports/customers/route.ts
// GET /api/reports/customers?from=&to=&limit=
//
// "New" = Customer.createdAt falls within the period.
// "Returning" = customers with a Bill/Order/Booking in this period whose
// Customer.createdAt predates the period start.
// Top customers ranked by total spend across all three revenue sources.
//
// Permission: report.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { customerReportQuerySchema, validate } from '@/lib/validation';
import { rankTopItems } from '@/lib/reports/reportMath';
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
    const { data, errors } = validate(customerReportQuerySchema, {
      from:  searchParams.get('from'),
      to:    searchParams.get('to'),
      limit: searchParams.get('limit') ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;
    const fromDate = new Date(`${data.from}T00:00:00`);
    const toDate   = new Date(`${data.to}T23:59:59`);

    const newCustomers = await prisma.customer.count({
      where: { tenantId, createdAt: { gte: fromDate, lte: toDate } },
    });

    // Distinct customers who transacted in this period
    const [orderCustomerIds, bookingCustomerIds] = await Promise.all([
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.booking.findMany({
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        select: { customerId: true },
        distinct: ['customerId'],
      }),
    ]);

    const activeUserIds = new Set([
      ...orderCustomerIds.map(o => o.userId),
      ...bookingCustomerIds.map(b => b.customerId),
    ]);

    let returningCustomers = 0;
    if (activeUserIds.size > 0) {
      returningCustomers = await prisma.customer.count({
        where: {
          tenantId,
          userId: { in: Array.from(activeUserIds) },
          createdAt: { lt: fromDate },
        },
      });
    }

    // Top customers by spend — combine order totals + booking totals per user
    const [orderTotals, bookingTotals] = await Promise.all([
      prisma.order.groupBy({
        by: ['userId'],
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
        _count: { id: true },
      }),
      prisma.booking.groupBy({
        by: ['customerId'],
        where: { tenantId, createdAt: { gte: fromDate, lte: toDate }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const spendMap = new Map<string, { spend: number; count: number }>();
    for (const o of orderTotals) {
      const existing = spendMap.get(o.userId) ?? { spend: 0, count: 0 };
      existing.spend += o._sum.total ?? 0;
      existing.count += o._count.id;
      spendMap.set(o.userId, existing);
    }
    for (const b of bookingTotals) {
      const existing = spendMap.get(b.customerId) ?? { spend: 0, count: 0 };
      existing.spend += b._sum.totalAmount ?? 0;
      existing.count += b._count.id;
      spendMap.set(b.customerId, existing);
    }

    const userIds = Array.from(spendMap.keys());
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const candidates = userIds.map(userId => {
      const u = userMap.get(userId);
      const s = spendMap.get(userId)!;
      return {
        id:         userId, // satisfies rankTopItems' { id, name, revenue } shape
        name:       u?.name ?? 'Unknown',
        revenue:    Math.round(s.spend * 100) / 100,
        orderCount: s.count,
        email:      u?.email ?? '',
      };
    });

    const topCustomers = rankTopItems(candidates, data.limit).map(c => ({
      userId:     c.id,
      name:       c.name,
      email:      c.email,
      totalSpend: c.revenue,
      orderCount: c.orderCount,
    }));

    return ok({
      report: {
        from: data.from,
        to:   data.to,
        newCustomers,
        returningCustomers,
        topCustomers,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
