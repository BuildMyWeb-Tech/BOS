// src/app/api/staff/[id]/deactivate/route.ts
// PATCH /api/staff/[id]/deactivate
//
// Toggle staff member active/inactive status.
// Body: { active: boolean }
//   active: false → deactivate (staff can no longer log in)
//   active: true  → reactivate
//
// Only VENDOR_OWNER / staff.manage can deactivate.
// A staff member cannot deactivate themselves.

import { NextRequest } from 'next/server';
import {
  authenticate,
  ok, badRequest, forbidden, notFound, serverError,
} from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const deactivateSchema = z.object({
  active: z.boolean({ required_error: 'active (boolean) is required' }),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.manage');

    if (!canManage) return forbidden('Missing permission: staff.manage');

    const { id: staffId } = await params;

    const staff = await prisma.staff.findFirst({
      where:  { id: staffId, tenantId: auth.tenantId },
      select: { id: true, userId: true, isActive: true, user: { select: { name: true } } },
    });
    if (!staff) return notFound('Staff member');

    // Prevent self-deactivation
    if (staff.userId === auth.userId) {
      return badRequest('You cannot deactivate your own account');
    }

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body is required');

    const result = deactivateSchema.safeParse(body);
    if (!result.success) {
      return badRequest('Provide { "active": true } or { "active": false }');
    }

    const { active } = result.data;

    if (staff.isActive === active) {
      return badRequest(
        `Staff member is already ${active ? 'active' : 'inactive'}`
      );
    }

    // Update both Staff.isActive and User.isActive (prevents login)
    await prisma.$transaction([
      prisma.staff.update({
        where: { id: staffId },
        data:  { isActive: active },
      }),
      prisma.user.update({
        where: { id: staff.userId },
        data:  { isActive: active },
      }),
    ]);

    const action = active ? 'reactivated' : 'deactivated';

    return ok(
      {
        staffId,
        userId:   staff.userId,
        isActive: active,
      },
      `Staff member ${staff.user.name} ${action} successfully`
    );
  } catch (error) {
    return serverError(error);
  }
}
