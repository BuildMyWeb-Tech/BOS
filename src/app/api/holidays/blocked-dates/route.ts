// src/app/api/holidays/blocked-dates/route.ts
// GET  /api/holidays/blocked-dates — list (optional from/to range filter)
// POST /api/holidays/blocked-dates — block a one-off date
//
// Permission: booking.view (GET), settings.manage (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { blockedDateSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const from = searchParams.get('from'); // "YYYY-MM-DD"
    const to   = searchParams.get('to');

    const dates = await prisma.blockedDate.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(from && to && { date: { gte: from, lte: to } }),
      },
      orderBy: { date: 'asc' },
    });

    return ok({
      blockedDates: dates.map(d => ({
        id:        d.id,
        tenantId:  d.tenantId,
        date:      d.date,
        reason:    d.reason,
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

    const { data, errors } = validate(blockedDateSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const existing = await prisma.blockedDate.findUnique({
      where: { tenantId_date: { tenantId: auth.tenantId, date: data.date } },
    });
    if (existing) return conflict(`${data.date} is already blocked`);

    const blocked = await prisma.blockedDate.create({
      data: {
        tenantId: auth.tenantId,
        date:     data.date,
        reason:   data.reason ?? null,
      },
    });

    return created(
      {
        blockedDate: {
          id:        blocked.id,
          tenantId:  blocked.tenantId,
          date:      blocked.date,
          reason:    blocked.reason,
          createdAt: blocked.createdAt,
        },
      },
      `${blocked.date} blocked`
    );
  } catch (error) {
    return serverError(error);
  }
}
