// src/app/api/holidays/recurring/route.ts
// GET  /api/holidays/recurring — list recurring holidays
// POST /api/holidays/recurring — create weekly or monthly recurring holiday
//
// Permission: booking.view (GET), settings.manage (POST)
//
// Duplicate prevention: no two weekly holidays for the same weekday,
// no two monthly holidays for the same day-of-month, within a tenant.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { recurringHolidaySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type'); // optional filter: weekly | monthly

    const holidays = await prisma.recurringHoliday.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(type && { type }),
      },
      orderBy: [{ type: 'asc' }, { value: 'asc' }],
    });

    return ok({
      recurringHolidays: holidays.map(h => ({
        id:        h.id,
        tenantId:  h.tenantId,
        name:      h.name,
        type:      h.type,
        value:     h.value,
        createdAt: h.createdAt,
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

    const { data, errors } = validate(recurringHolidaySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Prevent duplicate: same type + value within tenant
    const existing = await prisma.recurringHoliday.findFirst({
      where: { tenantId: auth.tenantId, type: data.type, value: data.value },
    });
    if (existing) {
      return conflict(
        data.type === 'weekly'
          ? `A weekly holiday for ${data.value} already exists ("${existing.name}")`
          : `A monthly holiday for day ${data.value} already exists ("${existing.name}")`
      );
    }

    const holiday = await prisma.recurringHoliday.create({
      data: {
        tenantId: auth.tenantId,
        name:     data.name,
        type:     data.type,
        value:    data.value,
      },
    });

    return created(
      {
        recurringHoliday: {
          id:        holiday.id,
          tenantId:  holiday.tenantId,
          name:      holiday.name,
          type:      holiday.type,
          value:     holiday.value,
          createdAt: holiday.createdAt,
        },
      },
      `Recurring holiday "${holiday.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
