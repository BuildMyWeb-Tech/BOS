// src/app/api/holidays/blocked-dates/[id]/route.ts
// DELETE /api/holidays/blocked-dates/[id] — unblock a date
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

    const blocked = await prisma.blockedDate.findFirst({
      where: { id, tenantId: auth.tenantId },
    });
    if (!blocked) return notFound('Blocked date');

    await prisma.blockedDate.delete({ where: { id } });

    return ok({ id, date: blocked.date }, `${blocked.date} unblocked`);
  } catch (error) {
    return serverError(error);
  }
}
