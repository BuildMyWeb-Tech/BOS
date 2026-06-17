// src/app/api/services/categories/[id]/route.ts
// GET    /api/services/categories/[id] — fetch category with its services
// PATCH  /api/services/categories/[id] — update name / description / isActive
// DELETE /api/services/categories/[id] — deactivate (soft delete)
//
// Hard delete is blocked if the category has active services.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, conflict, serverError,
} from '@/lib/api-helpers';
import { updateServiceCategorySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// ─── Helper ───────────────────────────────────────────────────────

async function getCategory(id: string, tenantId: string) {
  return prisma.serviceCategory.findFirst({
    where:   { id, tenantId },
    include: { _count: { select: { services: true } } },
  });
}

// ─── GET ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;
    const cat = await getCategory(id, auth.tenantId);
    if (!cat) return notFound('Category');

    // Include services in this category
    const services = await prisma.service.findMany({
      where:   { categoryId: id, tenantId: auth.tenantId },
      orderBy: { name: 'asc' },
      select:  { id: true, name: true, duration: true, price: true, isActive: true },
    });

    return ok({
      category: {
        id:           cat.id,
        name:         cat.name,
        description:  cat.description,
        isActive:     cat.isActive,
        serviceCount: cat._count.services,
        services,
        createdAt:    cat.createdAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── PATCH ────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canEdit =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.edit');
    if (!canEdit) return forbidden('Missing permission: booking.edit');

    const { id } = await params;
    const cat = await getCategory(id, auth.tenantId);
    if (!cat) return notFound('Category');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateServiceCategorySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Check name uniqueness if changing name
    if (data.name && data.name !== cat.name) {
      const dupe = await prisma.serviceCategory.findFirst({
        where: { name: data.name, tenantId: auth.tenantId, id: { not: id } },
        select: { id: true },
      });
      if (dupe) return conflict(`Category "${data.name}" already exists`);
    }

    const updated = await prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive }),
      },
    });

    return ok(
      {
        category: {
          id:           updated.id,
          name:         updated.name,
          description:  updated.description,
          isActive:     updated.isActive,
          serviceCount: cat._count.services,
          createdAt:    updated.createdAt,
        },
      },
      'Category updated'
    );
  } catch (error) {
    return serverError(error);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canDelete =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.delete');
    if (!canDelete) return forbidden('Missing permission: booking.delete');

    const { id } = await params;
    const cat = await getCategory(id, auth.tenantId);
    if (!cat) return notFound('Category');

    // Block delete if category has active services
    const activeServiceCount = await prisma.service.count({
      where: { categoryId: id, isActive: true, tenantId: auth.tenantId },
    });

    if (activeServiceCount > 0) {
      return badRequest(
        `Cannot delete category with ${activeServiceCount} active service(s). Deactivate or reassign services first.`
      );
    }

    // Soft delete — just deactivate
    await prisma.serviceCategory.update({
      where: { id },
      data:  { isActive: false },
    });

    return ok({ id }, `Category "${cat.name}" deactivated`);
  } catch (error) {
    return serverError(error);
  }
}
