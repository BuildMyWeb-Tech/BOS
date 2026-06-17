// src/app/api/services/[id]/route.ts
// GET    /api/services/[id] — full service detail + staff who can perform it
// PATCH  /api/services/[id] — update service fields
// DELETE /api/services/[id] — soft delete (isActive → false)
//
// Hard delete is never allowed — booking history references services.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, conflict, serverError,
} from '@/lib/api-helpers';
import { updateServiceSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getService(id: string, tenantId: string) {
  return prisma.service.findFirst({
    where:   { id, tenantId },
    include: {
      category: { select: { id: true, name: true } },
      _count:   { select: { bookingServices: true } },
    },
  });
}

// ─── GET ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;
    const service = await getService(id, auth.tenantId);
    if (!service) return notFound('Service');

    // Get active staff for this tenant (for staff-picker in booking flow)
    const staff = await prisma.staff.findMany({
      where:   { tenantId: auth.tenantId, isActive: true },
      select:  {
        id:      true,
        userId:  true,
        isActive: true,
        user:    { select: { name: true, email: true, image: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return ok({
      service: {
        id:           service.id,
        tenantId:     service.tenantId,
        categoryId:   service.categoryId,
        category:     service.category,
        name:         service.name,
        description:  service.description,
        duration:     service.duration,
        price:        service.price,
        isActive:     service.isActive,
        image:        service.image,
        bookingCount: service._count.bookingServices,
        createdAt:    service.createdAt,
        updatedAt:    service.updatedAt,
      },
      availableStaff: staff.map(s => ({
        id:       s.id,
        userId:   s.userId,
        name:     s.user.name,
        email:    s.user.email,
        image:    s.user.image,
        isActive: s.isActive,
      })),
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
    const service = await getService(id, auth.tenantId);
    if (!service) return notFound('Service');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateServiceSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Check name uniqueness if changing name
    if (data.name && data.name !== service.name) {
      const dupe = await prisma.service.findFirst({
        where: { name: data.name, tenantId: auth.tenantId, id: { not: id } },
        select: { id: true },
      });
      if (dupe) return conflict(`Service "${data.name}" already exists`);
    }

    // Validate category if provided
    if (data.categoryId) {
      const cat = await prisma.serviceCategory.findFirst({
        where:  { id: data.categoryId, tenantId: auth.tenantId, isActive: true },
        select: { id: true },
      });
      if (!cat) return badRequest('Category not found or inactive');
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.duration    !== undefined && { duration:    data.duration    }),
        ...(data.price       !== undefined && { price:       data.price       }),
        ...(data.categoryId  !== undefined && { categoryId:  data.categoryId  }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive    }),
        ...(data.image       !== undefined && { image:       data.image ?? '' }),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return ok(
      {
        service: {
          id:          updated.id,
          tenantId:    updated.tenantId,
          categoryId:  updated.categoryId,
          category:    updated.category,
          name:        updated.name,
          description: updated.description,
          duration:    updated.duration,
          price:       updated.price,
          isActive:    updated.isActive,
          image:       updated.image,
          createdAt:   updated.createdAt,
          updatedAt:   updated.updatedAt,
        },
      },
      'Service updated'
    );
  } catch (error) {
    return serverError(error);
  }
}

// ─── DELETE (soft) ────────────────────────────────────────────────

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
    const service = await getService(id, auth.tenantId);
    if (!service) return notFound('Service');

    // Warn but allow: future bookings referencing this service still work (price snapshot)
    // Just deactivate — never hard delete
    await prisma.service.update({
      where: { id },
      data:  { isActive: false },
    });

    return ok(
      { id, bookingCount: service._count.bookingServices },
      `Service "${service.name}" deactivated`
    );
  } catch (error) {
    return serverError(error);
  }
}
