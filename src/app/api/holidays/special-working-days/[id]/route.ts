// src/app/api/holidays/special-working-days/[id]/route.ts
// DELETE /api/holidays/special-working-days/[id]
//
// Permission: settings.manage

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

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
    const day = await prisma.specialWorkingDay.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!day) return notFound('Special working day');

    await prisma.specialWorkingDay.delete({ where: { id } });

    return ok({ id, date: day.date }, `Special working day ${day.date} removed`);
  } catch (error) {
    return serverError(error);
  }
}
