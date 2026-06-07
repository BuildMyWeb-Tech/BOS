// src/app/api/staff/[id]/permissions/route.ts
//
// GET    /api/staff/[id]/permissions — view current permissions grouped by module
// PATCH  /api/staff/[id]/permissions — replace staff permission set
// DELETE /api/staff/[id]/permissions — reset to default STAFF role permissions
//
// Only VENDOR_OWNER / staff.manage can modify permissions.
// Staff can view their own permissions.

import { NextRequest } from 'next/server';
import {
  authenticate,
  ok, badRequest, forbidden, notFound, serverError,
} from '@/lib/api-helpers';
import { updatePermissionsSchema, validate } from '@/lib/validation';
import { getUserPermissions, updateStaffPermissions } from '@/lib/auth-db';
import prisma from '@/lib/prisma';

// ─── GET /api/staff/[id]/permissions ─────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Staff can view own permissions, owner/admin can view any
    const isSelf = staff.userId === auth.userId;
    if (!isSelf && auth.role !== 'VENDOR_OWNER' && auth.role !== 'SUPER_ADMIN'
        && !auth.permissions.includes('staff.view')) {
      return forbidden('Missing permission: staff.view');
    }

    const permCodes = await getUserPermissions(staff.userId);

    // Group by module for UI consumption
    const allPermissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const grouped: Record<string, Array<{
      code: string; description: string; action: string; granted: boolean;
    }>> = {};

    for (const p of allPermissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push({
        code:        p.code,
        description: p.description,
        action:      p.action,
        granted:     permCodes.includes(p.code),
      });
    }

    const groups = Object.entries(grouped).map(([module, permissions]) => ({
      module,
      permissions,
    }));

    return ok({
      staffId,
      grantedPermissions: permCodes,
      groups,
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── PATCH /api/staff/[id]/permissions ───────────────────────────

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
      select: { id: true, userId: true },
    });
    if (!staff) return notFound('Staff member');

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body is required');

    const { data, errors } = validate(updatePermissionsSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Validate all permission codes exist in DB
    const validPerms = await prisma.permission.findMany({
      where: { code: { in: data.permissions } },
      select: { code: true },
    });
    const validCodes   = validPerms.map(p => p.code);
    const invalidCodes = data.permissions.filter(c => !validCodes.includes(c));

    if (invalidCodes.length > 0) {
      return badRequest(`Invalid permission codes: ${invalidCodes.join(', ')}`);
    }

    // Replace the custom permission set
    await updateStaffPermissions(staff.userId, auth.tenantId, data.permissions);

    // Return updated full permission list
    const updated = await getUserPermissions(staff.userId);

    return ok(
      { staffId, permissions: updated },
      'Permissions updated successfully'
    );
  } catch (error) {
    return serverError(error);
  }
}

// ─── DELETE /api/staff/[id]/permissions — reset to defaults ──────

export async function DELETE(
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
      select: { id: true, userId: true },
    });
    if (!staff) return notFound('Staff member');

    // Remove all custom permissions → falls back to system STAFF role
    await updateStaffPermissions(staff.userId, auth.tenantId, []);

    const defaultPerms = await getUserPermissions(staff.userId);

    return ok(
      { staffId, permissions: defaultPerms },
      'Permissions reset to default STAFF role'
    );
  } catch (error) {
    return serverError(error);
  }
}
