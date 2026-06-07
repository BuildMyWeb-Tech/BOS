// src/app/api/staff/route.ts
//
// GET  /api/staff — list all staff for the authenticated tenant
// POST /api/staff — create a new staff member
//
// Auth: VENDOR_OWNER or SUPER_ADMIN
// Permission required for POST: staff.manage
// Permission required for GET:  staff.view

import { NextRequest } from 'next/server';
import {
  authenticate,
  ok, created, badRequest, forbidden, conflict, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { createStaffSchema, validate } from '@/lib/validation';
import { createStaffUser, getUserPermissions } from '@/lib/auth-db';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── GET /api/staff ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    // Must belong to a tenant and have staff.view
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.view');

    if (!canView) return forbidden('Missing permission: staff.view');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);
    const activeOnly = searchParams.get('active') !== 'false'; // default: active only

    const where: Prisma.StaffWhereInput = {
      tenantId: auth.tenantId,
      ...(activeOnly && { isActive: true }),
    };

    if (pagination.search) {
      where.user = {
        OR: [
          { name:  { contains: pagination.search, mode: 'insensitive' } },
          { email: { contains: pagination.search, mode: 'insensitive' } },
        ],
      };
    }

    const [staffList, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip:  paginationSkip(pagination),
        take:  pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id:        true,
          userId:    true,
          bio:       true,
          leaveDates: true,
          isActive:  true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, phone: true, image: true },
          },
        },
      }),
      prisma.staff.count({ where }),
    ]);

    // Fetch permissions per staff member
    const items = await Promise.all(
      staffList.map(async (s) => {
        const permissions = await getUserPermissions(s.userId);
        return {
          id:          s.id,
          userId:      s.userId,
          name:        s.user.name,
          email:       s.user.email,
          phone:       s.user.phone,
          image:       s.user.image,
          bio:         s.bio,
          isActive:    s.isActive,
          permissions,
          leaveCount:  s.leaveDates.length,
          createdAt:   s.createdAt,
        };
      })
    );

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items,
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/staff ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    // Only VENDOR_OWNER (or SUPER_ADMIN) with staff.manage can create staff
    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('staff.manage');

    if (!canManage) return forbidden('Missing permission: staff.manage');

    // Validate input
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body is required');

    const { data, errors } = validate(createStaffSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const { name, email, password, phone, bio, permissions } = data;

    // Check email not already in use within this tenant
    const existing = await prisma.user.findFirst({
      where: { email, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (existing) return conflict('A user with this email already exists in this business');

    // Validate permission codes if provided
    if (permissions && permissions.length > 0) {
      const validPerms = await prisma.permission.findMany({
        where: { code: { in: permissions } },
        select: { code: true },
      });
      const validCodes   = validPerms.map(p => p.code);
      const invalidCodes = permissions.filter(c => !validCodes.includes(c));
      if (invalidCodes.length > 0) {
        return badRequest(`Invalid permission codes: ${invalidCodes.join(', ')}`);
      }
    }

    // Create staff in transaction
    const staffUser = await prisma.$transaction(async (tx) => {
      return createStaffUser(tx, {
        name, email, password,
        phone:       phone ?? null,
        bio:         bio ?? null,
        tenantId:    auth.tenantId!,
        permissions: permissions ?? [],
      });
    });

    // Fetch the created staff profile
    const staff = await prisma.staff.findUnique({
      where: { userId: staffUser.id },
      select: { id: true, bio: true, leaveDates: true, isActive: true, createdAt: true },
    });

    const staffPermissions = await getUserPermissions(staffUser.id);

    return created(
      {
        staff: {
          id:          staff!.id,
          userId:      staffUser.id,
          name:        staffUser.name,
          email:       staffUser.email,
          phone:       staffUser.phone,
          image:       staffUser.image,
          bio:         staff!.bio,
          isActive:    staff!.isActive,
          permissions: staffPermissions,
          leaveCount:  0,
          createdAt:   staff!.createdAt,
        },
      },
      `Staff member ${name} created successfully`
    );
  } catch (error) {
    // Surface permission code validation errors clearly
    if (error instanceof Error && error.message.includes('Invalid permission codes')) {
      return badRequest(error.message);
    }
    return serverError(error);
  }
}
