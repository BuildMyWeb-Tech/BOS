// src/app/api/dashboard/stats/route.ts
// GET /api/dashboard/stats
//
// Returns dashboard overview numbers for the authenticated vendor.
// All figures are scoped to the tenant in the JWT.
// Super Admin gets platform-wide counts.

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId && auth.role !== 'SUPER_ADMIN') {
      return forbidden('No tenant context');
    }

    const tenantId = auth.tenantId;

    // Date ranges
    const now          = new Date();
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const tenantFilter = tenantId ? { tenantId } : {};

    // Run all counts in parallel
    const [
      totalCustomers,
      newCustomersThisMonth,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      bookingsToday,
      bookingsThisMonth,
      pendingBookings,
      confirmedBookings,
      ordersToday,
      ordersThisMonth,
      pendingOrders,
      revenueThisMonth,
      revenueLastMonth,
      revenueToday,
    ] = await Promise.all([
      // Customers
      prisma.customer.count({ where: tenantFilter }),
      prisma.customer.count({
        where: { ...tenantFilter, createdAt: { gte: monthStart } },
      }),

      // Products
      prisma.product.count({ where: { ...tenantFilter, isDeleted: false } }),
      prisma.inventory.count({
        where: {
          ...tenantFilter,
          quantity: { gt: 0 },
          AND: [{ quantity: { lte: prisma.inventory.fields.lowStock as never } }],
        },
      }).catch(() =>
        // Fallback: low stock = quantity < 10
        prisma.inventory.count({ where: { ...tenantFilter, quantity: { gt: 0, lt: 10 } } })
      ),
      prisma.product.count({ where: { ...tenantFilter, inStock: false, isDeleted: false } }),

      // Bookings
      prisma.booking.count({
        where: { ...tenantFilter, createdAt: { gte: todayStart } },
      }),
      prisma.booking.count({
        where: { ...tenantFilter, createdAt: { gte: monthStart } },
      }),
      prisma.booking.count({
        where: { ...tenantFilter, status: 'PENDING_PAYMENT' },
      }),
      prisma.booking.count({
        where: { ...tenantFilter, status: 'CONFIRMED' },
      }),

      // Orders
      prisma.order.count({
        where: { ...tenantFilter, createdAt: { gte: todayStart } },
      }),
      prisma.order.count({
        where: { ...tenantFilter, createdAt: { gte: monthStart } },
      }),
      prisma.order.count({
        where: { ...tenantFilter, status: 'ORDER_PLACED' },
      }),

      // Revenue (from Sale table — source of truth)
      prisma.sale.aggregate({
        where: { ...tenantFilter, createdAt: { gte: monthStart } },
        _sum:  { amount: true },
      }),
      prisma.sale.aggregate({
        where: { ...tenantFilter, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
        _sum:  { amount: true },
      }),
      prisma.sale.aggregate({
        where: { ...tenantFilter, createdAt: { gte: todayStart } },
        _sum:  { amount: true },
      }),
    ]);

    const thisMonth = revenueThisMonth._sum.amount  ?? 0;
    const lastMonth = revenueLastMonth._sum.amount  ?? 0;
    const today     = revenueToday._sum.amount      ?? 0;
    const trend     = lastMonth === 0 ? 0 : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);

    return ok({
      stats: {
        revenue: {
          today,
          thisMonth,
          lastMonth,
          trend,
        },
        bookings: {
          today:     bookingsToday,
          thisMonth: bookingsThisMonth,
          pending:   pendingBookings,
          confirmed: confirmedBookings,
        },
        orders: {
          today:     ordersToday,
          thisMonth: ordersThisMonth,
          pending:   pendingOrders,
        },
        customers: {
          total:         totalCustomers,
          newThisMonth:  newCustomersThisMonth,
        },
        products: {
          total:       totalProducts,
          lowStock:    lowStockProducts,
          outOfStock:  outOfStockProducts,
        },
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
