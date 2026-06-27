// src/app/api/reports/revenue/route.ts
// GET /api/reports/revenue?from=&to=&bucket=day|week|month
//
// Pulls from the unified Sale ledger, split by Sale.source (BILLING/ORDER)
// plus Booking.totalAmount for booking revenue (bookings aren't recorded
// in Sale — only completed/confirmed bookings count as revenue, matching
// the dashboard stats convention from Phase 2).
//
// Permission: report.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { revenueReportQuerySchema, validate } from '@/lib/validation';
import { generateBucketSequence, bucketAmounts, calculateGrowthPercent } from '@/lib/reports/reportMath';
import prisma from '@/lib/prisma';
import type { ReportBucket } from '@/types';

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
    const { data, errors } = validate(revenueReportQuerySchema, {
      from:   searchParams.get('from'),
      to:     searchParams.get('to'),
      bucket: searchParams.get('bucket') ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;
    const bucket = data.bucket as ReportBucket;
    const fromDate = new Date(`${data.from}T00:00:00`);
    const toDate   = new Date(`${data.to}T23:59:59`);

    const [billingSales, orderSales, bookings] = await Promise.all([
      prisma.sale.findMany({
        where: { tenantId, source: 'BILLING', createdAt: { gte: fromDate, lte: toDate } },
        select: { amount: true, createdAt: true },
      }),
      prisma.sale.findMany({
        where: { tenantId, source: 'ORDER', createdAt: { gte: fromDate, lte: toDate } },
        select: { amount: true, createdAt: true },
      }),
      prisma.booking.findMany({
        where: {
          tenantId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          createdAt: { gte: fromDate, lte: toDate },
        },
        select: { totalAmount: true, createdAt: true },
      }),
    ]);

    const billingBuckets = bucketAmounts(billingSales.map(s => ({ date: s.createdAt, amount: s.amount })), bucket);
    const orderBuckets   = bucketAmounts(orderSales.map(s => ({ date: s.createdAt, amount: s.amount })), bucket);
    const bookingBuckets = bucketAmounts(bookings.map(b => ({ date: b.createdAt, amount: b.totalAmount })), bucket);

    const allLabels = generateBucketSequence(data.from, data.to, bucket);

    const points = allLabels.map(label => {
      const bookingRevenue = bookingBuckets.get(label) ?? 0;
      const billingRevenue = billingBuckets.get(label) ?? 0;
      const orderRevenue   = orderBuckets.get(label)   ?? 0;
      return {
        bucketLabel: label,
        bookingRevenue,
        billingRevenue,
        orderRevenue,
        total: Math.round((bookingRevenue + billingRevenue + orderRevenue) * 100) / 100,
      };
    });

    const totalBookingRevenue = points.reduce((s, p) => s + p.bookingRevenue, 0);
    const totalBillingRevenue = points.reduce((s, p) => s + p.billingRevenue, 0);
    const totalOrderRevenue   = points.reduce((s, p) => s + p.orderRevenue, 0);
    const totalRevenue = Math.round((totalBookingRevenue + totalBillingRevenue + totalOrderRevenue) * 100) / 100;

    // Growth vs the immediately preceding period of equal length
    const periodMs = toDate.getTime() - fromDate.getTime();
    const priorFrom = new Date(fromDate.getTime() - periodMs - 1000);
    const priorTo   = new Date(fromDate.getTime() - 1000);

    const [priorBilling, priorOrders, priorBookings] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, source: 'BILLING', createdAt: { gte: priorFrom, lte: priorTo } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { tenantId, source: 'ORDER', createdAt: { gte: priorFrom, lte: priorTo } },
        _sum: { amount: true },
      }),
      prisma.booking.aggregate({
        where: {
          tenantId, status: { in: ['CONFIRMED', 'COMPLETED'] },
          createdAt: { gte: priorFrom, lte: priorTo },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    const priorTotal =
      (priorBilling._sum.amount ?? 0) +
      (priorOrders._sum.amount ?? 0) +
      (priorBookings._sum.totalAmount ?? 0);

    return ok({
      report: {
        from: data.from,
        to:   data.to,
        bucket,
        points,
        summary: {
          totalRevenue,
          bookingRevenue: Math.round(totalBookingRevenue * 100) / 100,
          billingRevenue: Math.round(totalBillingRevenue * 100) / 100,
          orderRevenue:   Math.round(totalOrderRevenue * 100) / 100,
          growthPercent:  calculateGrowthPercent(totalRevenue, priorTotal),
        },
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
