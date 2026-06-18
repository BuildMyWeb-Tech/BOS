// src/app/api/holidays/calendar/route.ts
// GET /api/holidays/calendar?year=2026&month=6
//
// Returns the resolved open/closed status for every day in the
// requested month, combining: SlotConfig.daysOpen + RecurringHoliday
// + BlockedDate + SpecialWorkingDay.
//
// This is what the booking calendar UI renders directly.
// Permission: booking.view

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { calendarQuerySchema, validate } from '@/lib/validation';
import { resolveCalendarMonth } from '@/lib/booking/calendarEngine';
import prisma from '@/lib/prisma';
import type { DayOfWeek } from '@/types';

const DEFAULT_DAYS_OPEN: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

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

    const { year, month } = data;

    // Compute month date range for filtering blocked/special dates
    const monthStr  = String(month).padStart(2, '0');
    const fromDate   = `${year}-${monthStr}-01`;
    const lastDay    = new Date(year, month, 0).getDate();
    const toDate     = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Fetch all data in parallel
    const [slotConfig, blockedDates, recurringHolidays, specialWorkingDays] = await Promise.all([
      prisma.slotConfig.findUnique({
        where:  { tenantId: auth.tenantId },
        select: { daysOpen: true },
      }),
      prisma.blockedDate.findMany({
        where:  { tenantId: auth.tenantId, date: { gte: fromDate, lte: toDate } },
        select: { date: true, reason: true },
      }),
      prisma.recurringHoliday.findMany({
        where:  { tenantId: auth.tenantId },
        select: { name: true, type: true, value: true },
      }),
      prisma.specialWorkingDay.findMany({
        where:  { tenantId: auth.tenantId, date: { gte: fromDate, lte: toDate } },
        select: { date: true },
      }),
    ]);

    const daysOpen = (slotConfig?.daysOpen as DayOfWeek[] | undefined) ?? DEFAULT_DAYS_OPEN;

    const calendarView = resolveCalendarMonth({
      year,
      month,
      daysOpen,
      blockedDates,
      recurringHolidays,
      specialWorkingDays,
    });

    return ok({ calendar: calendarView });
  } catch (error) {
    return serverError(error);
  }
}
