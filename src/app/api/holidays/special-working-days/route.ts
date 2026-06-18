// src/app/api/holidays/special-working-days/route.ts
// GET  /api/holidays/special-working-days — list
// POST /api/holidays/special-working-days — mark a normally-closed day as open
//
// Permission: settings.manage

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { specialWorkingDaySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const days = await prisma.specialWorkingDay.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(from && to && { date: { gte: from, lte: to } }),
      },
      orderBy: { date: 'asc' },
    });

    return ok({
      specialWorkingDays: days.map(d => ({
        id:        d.id,
        tenantId:  d.tenantId,
        date:      d.date,
        createdAt: d.createdAt,
      })),
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

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.manage');
    if (!canManage) return forbidden('Missing permission: settings.manage');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(specialWorkingDaySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const existing = await prisma.specialWorkingDay.findUnique({
      where: { tenantId_date: { tenantId: auth.tenantId, date: data.date } },
    });
    if (existing) return conflict(`${data.date} is already marked as a special working day`);

    // Informational: warn if this date is ALSO blocked (blocked takes priority
    // unless this is created, then special-override wins per calendarEngine rules —
    // but we let the vendor know the existing state if any)
    const blockedConflict = await prisma.blockedDate.findUnique({
      where: { tenantId_date: { tenantId: auth.tenantId, date: data.date } },
    });

    const day = await prisma.specialWorkingDay.create({
      data: { tenantId: auth.tenantId, date: data.date },
    });

    return created(
      {
        specialWorkingDay: {
          id:        day.id,
          tenantId:  day.tenantId,
          date:      day.date,
          createdAt: day.createdAt,
        },
        note: blockedConflict
          ? `Note: ${data.date} was previously blocked — this special working day now overrides that and the date will show as OPEN.`
          : undefined,
      },
      `${day.date} marked as a special working day`
    );
  } catch (error) {
    return serverError(error);
  }
}
