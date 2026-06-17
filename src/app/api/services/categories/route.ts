// src/app/api/services/categories/route.ts
// GET  /api/services/categories — list all categories for the tenant
// POST /api/services/categories — create a new service category
//
// Permission: booking.view (GET), booking.create (POST)
// Module guard: booking must be enabled

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { serviceCategorySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

// ─── GET /api/services/categories ────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const categories = await prisma.serviceCategory.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { services: true } } },
    });

    return ok({
      categories: categories.map(c => ({
        id:           c.id,
        tenantId:     c.tenantId,
        name:         c.name,
        description:  c.description,
        isActive:     c.isActive,
        serviceCount: c._count.services,
        createdAt:    c.createdAt,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/services/categories ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    if (!auth.tenantId) return forbidden('No tenant context');

    const canCreate =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.create');

    if (!canCreate) return forbidden('Missing permission: booking.create');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(serviceCategorySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Unique name within tenant
    const existing = await prisma.serviceCategory.findFirst({
      where: { name: data.name, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (existing) return conflict(`Category "${data.name}" already exists`);

    const category = await prisma.serviceCategory.create({
      data: {
        tenantId:    auth.tenantId,
        name:        data.name,
        description: data.description ?? '',
        isActive:    true,
      },
    });

    return created(
      {
        category: {
          id:           category.id,
          tenantId:     category.tenantId,
          name:         category.name,
          description:  category.description,
          isActive:     category.isActive,
          serviceCount: 0,
          createdAt:    category.createdAt,
        },
      },
      `Category "${category.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
