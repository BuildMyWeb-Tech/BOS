// src/app/api/holidays/recurring/[id]/route.ts
// PATCH  /api/holidays/recurring/[id] — update name/type/value
// DELETE /api/holidays/recurring/[id] — remove
//
// Permission: settings.manage

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, conflict, serverError,
} from '@/lib/api-helpers';
import { updateRecurringHolidaySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.manage');
    if (!canManage) return forbidden('Missing permission: settings.manage');

    const { id } = await params;
    const holiday = await prisma.recurringHoliday.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!holiday) return notFound('Recurring holiday');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateRecurringHolidaySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const newType  = data.type  ?? holiday.type;
    const newValue = data.value ?? holiday.value;

    // Check for duplicates if type or value changing
    if (data.type || data.value) {
      const dupe = await prisma.recurringHoliday.findFirst({
        where: {
          tenantId: auth.tenantId,
          type:     newType,
          value:    newValue,
          id:       { not: id },
        },
      });
      if (dupe) {
        return conflict(`A ${newType} holiday for "${newValue}" already exists ("${dupe.name}")`);
      }
    }

    const updated = await prisma.recurringHoliday.update({
      where: { id },
      data: {
        ...(data.name  !== undefined && { name:  data.name  }),
        ...(data.type  !== undefined && { type:  data.type  }),
        ...(data.value !== undefined && { value: data.value }),
      },
    });

    return ok(
      {
        recurringHoliday: {
          id:        updated.id,
          tenantId:  updated.tenantId,
          name:      updated.name,
          type:      updated.type,
          value:     updated.value,
          createdAt: updated.createdAt,
        },
      },
      'Recurring holiday updated'
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.manage');
    if (!canManage) return forbidden('Missing permission: settings.manage');

    const { id } = await params;
    const holiday = await prisma.recurringHoliday.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!holiday) return notFound('Recurring holiday');

    await prisma.recurringHoliday.delete({ where: { id } });

    return ok({ id }, `Recurring holiday "${holiday.name}" removed`);
  } catch (error) {
    return serverError(error);
  }
}
