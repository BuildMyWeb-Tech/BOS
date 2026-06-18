// src/app/api/staff/[id]/leave-dates/route.ts
// GET   /api/staff/[id]/leave-dates — view a staff member's leave dates
// PATCH /api/staff/[id]/leave-dates — replace the full leave dates array
//
// [id] is Staff.id. Staff can manage their own leave dates;
// VENDOR_OWNER/staff.manage can manage anyone's.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, serverError,
} from '@/lib/api-helpers';
import { updateLeaveDatesSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id: staffId } = await params;

    const staff = await prisma.staff.findFirst({
      where:  { id: staffId, tenantId: auth.tenantId },
      select: { id: true, userId: true, leaveDates: true },
    });
    if (!staff) return notFound('Staff member');

    const isSelf = staff.userId === auth.userId;
    const canView =
      isSelf ||
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.view');
    if (!canView) return forbidden('Missing permission: staff.view');

    return ok({
      staffId:    staff.id,
      leaveDates: staff.leaveDates,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id: staffId } = await params;

    const staff = await prisma.staff.findFirst({
      where:  { id: staffId, tenantId: auth.tenantId },
      select: { id: true, userId: true },
    });
    if (!staff) return notFound('Staff member');

    // Staff can manage their own leave dates; owner/staff.manage can manage anyone's
    const isSelf = staff.userId === auth.userId;
    const canManage =
      isSelf ||
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.manage');
    if (!canManage) return forbidden('You do not have permission to manage these leave dates');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateLeaveDatesSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Deduplicate and sort
    const uniqueSorted = [...new Set(data.leaveDates)].sort();

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data:  { leaveDates: uniqueSorted },
      select: { id: true, leaveDates: true },
    });

    return ok(
      { staffId: updated.id, leaveDates: updated.leaveDates },
      `Leave dates updated (${updated.leaveDates.length} total)`
    );
  } catch (error) {
    return serverError(error);
  }
}
