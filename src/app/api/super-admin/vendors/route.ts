// src/app/api/super-admin/vendors/route.ts
// GET /api/super-admin/vendors
//
// List all vendors with pagination, search, and status filter.
// Super Admin only.
//
// Query params:
//   page    : number (default 1)
//   limit   : number (default 20, max 100)
//   search  : string (searches name, email, slug)
//   status  : PENDING | APPROVED | REJECTED | SUSPENDED
//   sortBy  : createdAt | name (default createdAt)
//   sortDir : asc | desc (default desc)

import { NextRequest } from 'next/server';
import { authenticateSuperAdmin, ok, serverError, parsePagination, paginationSkip } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // ── Step 1: Super Admin only ──────────────────────────────────
    const auth = await authenticateSuperAdmin(request);
    if (auth instanceof Response) return auth;

    // ── Step 2: Parse query params ────────────────────────────────
    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);
    const status     = searchParams.get('status') ?? undefined;

    // ── Step 3: Build where clause ────────────────────────────────
    const where: Prisma.TenantWhereInput = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(status)) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    }

    if (pagination.search) {
      where.OR = [
        { name:  { contains: pagination.search, mode: 'insensitive' } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
        { slug:  { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    // ── Step 4: Sort ──────────────────────────────────────────────
    const allowedSortFields = ['createdAt', 'name', 'status'];
    const sortBy  = allowedSortFields.includes(pagination.sortBy ?? '')
      ? pagination.sortBy!
      : 'createdAt';
    const sortDir = pagination.sortDir ?? 'desc';

    const orderBy: Prisma.TenantOrderByWithRelationInput = { [sortBy]: sortDir };

    // ── Step 5: Query ─────────────────────────────────────────────
    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy,
        skip:  paginationSkip(pagination),
        take:  pagination.limit,
        select: {
          id:           true,
          name:         true,
          slug:         true,
          businessType: true,
          email:        true,
          phone:        true,
          address:      true,
          logo:         true,
          status:       true,
          isActive:     true,
          modules:      true,
          createdAt:    true,
          _count: {
            select: { users: true },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: tenants.map(t => ({
        id:           t.id,
        name:         t.name,
        slug:         t.slug,
        businessType: t.businessType,
        email:        t.email,
        phone:        t.phone,
        address:      t.address,
        logo:         t.logo,
        status:       t.status,
        isActive:     t.isActive,
        modules:      t.modules,
        userCount:    t._count.users,
        createdAt:    t.createdAt,
      })),
      pagination: {
        total,
        page:       pagination.page,
        limit:      pagination.limit,
        totalPages,
        hasNext:    pagination.page < totalPages,
        hasPrev:    pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
