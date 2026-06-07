// src/app/api/staff/[id]/route.ts
//
// GET   /api/staff/[id] — fetch full staff profile
// PATCH /api/staff/[id] — update name, phone, bio
//
// [id] is Staff.id (not User.id)
// Staff can view their own profile. Owners can view any staff in their tenant.

import { NextRequest } from 'next/server';
import {
  authenticate,
  ok, badRequest, forbidden, notFound, serverError,
} from '@/lib/api-helpers';
import { updateStaffSchema, validate } from '@/lib/validation';
import { getUserPermissions } from '@/lib/auth-db';
import prisma from '@/lib/prisma';

// ─── Shared: fetch staff and verify tenant ownership ─────────────

async function getStaffRecord(staffId: string, tenantId: string) {
  return prisma.staff.findFirst({
    where: { id: staffId, tenantId },
    select: {
      id:        true,
      userId:    true,
      tenantId:  true,
      bio:       true,
      leaveDates: true,
      isActive:  true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: { id: true, name: true, email: true, phone: true, image: true },
      },
      _count: { select: { bookings: true } },
    },
  });
}

// ─── GET /api/staff/[id] ─────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    const { id: staffId } = await params;

    const staff = await getStaffRecord(staffId, auth.tenantId);
    if (!staff) return notFound('Staff member');

    // Staff can only view their own profile
    if (auth.role === 'STAFF' && staff.userId !== auth.userId) {
      return forbidden('You can only view your own profile');
    }

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.view') ||
      staff.userId === auth.userId; // own profile always allowed

    if (!canView) return forbidden('Missing permission: staff.view');

    const permissions = await getUserPermissions(staff.userId);

    return ok({
      staff: {
        id:           staff.id,
        userId:       staff.userId,
        name:         staff.user.name,
        email:        staff.user.email,
        phone:        staff.user.phone,
        image:        staff.user.image,
        bio:          staff.bio,
        isActive:     staff.isActive,
        leaveDates:   staff.leaveDates,
        permissions,
        leaveCount:   staff.leaveDates.length,
        bookingCount: staff._count.bookings,
        createdAt:    staff.createdAt,
        updatedAt:    staff.updatedAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── PATCH /api/staff/[id] ────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    const { id: staffId } = await params;

    const staff = await getStaffRecord(staffId, auth.tenantId);
    if (!staff) return notFound('Staff member');

    // Staff can edit their own profile (name, phone, bio)
    // Owner/admin can edit any staff profile
    const isSelf    = staff.userId === auth.userId;
    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.manage');

    if (!isSelf && !canManage) {
      return forbidden('You do not have permission to edit this staff profile');
    }

    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body is required');

    const { data, errors } = validate(updateStaffSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const { name, phone, bio } = data;

    // Update User and Staff in parallel
    await Promise.all([
      (name || phone !== undefined)
        ? prisma.user.update({
            where: { id: staff.userId },
            data: {
              ...(name  !== undefined && { name }),
              ...(phone !== undefined && { phone: phone ?? null }),
            },
          })
        : Promise.resolve(),

      bio !== undefined
        ? prisma.staff.update({
            where: { id: staffId },
            data:  { bio: bio ?? null },
          })
        : Promise.resolve(),
    ]);

    // Return updated profile
    const updated = await getStaffRecord(staffId, auth.tenantId);
    const permissions = await getUserPermissions(staff.userId);

    return ok(
      {
        staff: {
          id:          updated!.id,
          userId:      updated!.userId,
          name:        updated!.user.name,
          email:       updated!.user.email,
          phone:       updated!.user.phone,
          image:       updated!.user.image,
          bio:         updated!.bio,
          isActive:    updated!.isActive,
          leaveDates:  updated!.leaveDates,
          permissions,
          leaveCount:  updated!.leaveDates.length,
          bookingCount: updated!._count.bookings,
          createdAt:   updated!.createdAt,
          updatedAt:   updated!.updatedAt,
        },
      },
      'Staff profile updated'
    );
  } catch (error) {
    return serverError(error);
  }
}
