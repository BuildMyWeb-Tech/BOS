// src/app/api/holidays/calendar/route.ts
// GET /api/holidays/calendar?year=&month=
//
// Returns the resolved calendar month view (open/closed per day) by
// layering: daysOpen baseline → recurring holidays → blocked dates →
// special working day overrides. Delegates all the date logic to
// resolveCalendarMonth() in calendarEngine.ts.
//
// Permission: booking.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { calendarQuerySchema, validate } from '@/lib/validation';
import { resolveCalendarMonth } from '@/lib/booking/calendarEngine';
import prisma from '@/lib/prisma';
import type { DayOfWeek } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.view');
    if (!canView) return forbidden('Missing permission: booking.view');

    const { searchParams } = request.nextUrl;
    const { data, errors } = validate(calendarQuerySchema, {
      year:  searchParams.get('year'),
      month: searchParams.get('month'),
    });
    if (errors) return badRequest('Validation failed', errors);

    const tenantId = auth.tenantId;

    const [slotConfig, blockedDates, recurringHolidaysRaw, specialWorkingDays] = await Promise.all([
      prisma.slotConfig.findUnique({ where: { tenantId }, select: { daysOpen: true } }),
      prisma.blockedDate.findMany({
        where:  { tenantId },
        select: { date: true, reason: true },
      }),
      prisma.recurringHoliday.findMany({
        where:  { tenantId },
        select: { name: true, type: true, value: true },
      }),
      prisma.specialWorkingDay.findMany({
        where:  { tenantId },
        select: { date: true },
      }),
    ]);

    // Prisma widens the `type` column to `string` even though only
    // 'weekly' | 'monthly' are ever written (enforced by
    // recurringHolidaySchema's Zod validation on the write path) — narrow
    // it back here at the read boundary rather than weakening the
    // calendarEngine's input type.
    const recurringHolidays = recurringHolidaysRaw.map(h => ({
      ...h,
      type: h.type as 'weekly' | 'monthly',
    }));

    const daysOpen = (slotConfig?.daysOpen as DayOfWeek[] | undefined) ?? [];

    const calendar = resolveCalendarMonth({
      year:  data.year,
      month: data.month,
      daysOpen,
      blockedDates,
      recurringHolidays,
      specialWorkingDays,
    });

    return ok({ calendar });
  } catch (error) {
    return serverError(error);
  }
}