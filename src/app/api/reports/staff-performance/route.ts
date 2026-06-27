// src/app/api/reports/staff-performance/route.ts
// GET /api/reports/staff-performance?from=&to=
//
// Booking-module specific. Groups Booking rows by staffId, counting
// total bookings, completed bookings, and revenue (CONFIRMED+COMPLETED only).
//
// Permission: report.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { staffPerformanceQuerySchema, validate } from '@/lib/validation';
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
    const { data, errors } = validate(staffPerformanceQuerySchema, {
      from: searchParams.get('from'),
      to:   searchParams.get('to'),
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;
    const fromDate = new Date(`${data.from}T00:00:00`);
    const toDate   = new Date(`${data.to}T23:59:59`);

    const allStaff = await prisma.staff.findMany({
      where: { tenantId },
      select: { id: true, user: { select: { name: true } } },
    });

    const bookings = await prisma.booking.findMany({
      where: {
        tenantId,
        staffId: { not: null },
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { staffId: true, status: true, totalAmount: true },
    });

    const statsByStaff = new Map<string, { bookingCount: number; completedCount: number; revenue: number }>();

    for (const b of bookings) {
      if (!b.staffId) continue;
      const existing = statsByStaff.get(b.staffId) ?? { bookingCount: 0, completedCount: 0, revenue: 0 };
      existing.bookingCount += 1;
      if (b.status === 'COMPLETED') existing.completedCount += 1;
      if (b.status === 'CONFIRMED' || b.status === 'COMPLETED') {
        existing.revenue = Math.round((existing.revenue + b.totalAmount) * 100) / 100;
      }
      statsByStaff.set(b.staffId, existing);
    }

    const staffReport = allStaff.map(s => {
      const stats = statsByStaff.get(s.id) ?? { bookingCount: 0, completedCount: 0, revenue: 0 };
      return {
        staffId:        s.id,
        name:           s.user.name,
        bookingCount:   stats.bookingCount,
        completedCount: stats.completedCount,
        revenue:        stats.revenue,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return ok({
      report: { from: data.from, to: data.to, staff: staffReport },
    });
  } catch (error) {
    return serverError(error);
  }
}
