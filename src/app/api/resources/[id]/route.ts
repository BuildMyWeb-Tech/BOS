// src/app/api/resources/[id]/route.ts
// GET    /api/resources/[id]
// PATCH  /api/resources/[id]
// DELETE /api/resources/[id] — deactivate (soft delete)
//
// Cannot hard delete a resource that has bookings.

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, conflict, serverError,
} from '@/lib/api-helpers';
import { updateResourceSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getResource(id: string, tenantId: string) {
  return prisma.resource.findFirst({
    where:   { id, tenantId },
    include: { _count: { select: { bookings: true } } },
  });
}

// ─── GET ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;
    const resource = await getResource(id, auth.tenantId);
    if (!resource) return notFound('Resource');

    return ok({
      resource: {
        id:           resource.id,
        tenantId:     resource.tenantId,
        name:         resource.name,
        type:         resource.type,
        description:  resource.description,
        isActive:     resource.isActive,
        bookingCount: resource._count.bookings,
        createdAt:    resource.createdAt,
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
    const resource = await getResource(id, auth.tenantId);
    if (!resource) return notFound('Resource');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateResourceSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Check name uniqueness if changing
    if (data.name && data.name !== resource.name) {
      const dupe = await prisma.resource.findFirst({
        where: { name: data.name, tenantId: auth.tenantId, id: { not: id } },
        select: { id: true },
      });
      if (dupe) return conflict(`Resource "${data.name}" already exists`);
    }

    const updated = await prisma.resource.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name        }),
        ...(data.type        !== undefined && { type:        data.type        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive    !== undefined && { isActive:    data.isActive    }),
      },
    });

    return ok(
      {
        resource: {
          id:           updated.id,
          tenantId:     updated.tenantId,
          name:         updated.name,
          type:         updated.type,
          description:  updated.description,
          isActive:     updated.isActive,
          bookingCount: resource._count.bookings,
          createdAt:    updated.createdAt,
        },
      },
      'Resource updated'
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
    const resource = await getResource(id, auth.tenantId);
    if (!resource) return notFound('Resource');

    // Block if it has upcoming (non-completed) bookings
    const upcomingCount = await prisma.booking.count({
      where: {
        resourceId: id,
        tenantId:   auth.tenantId,
        status:     { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
      },
    });

    if (upcomingCount > 0) {
      return badRequest(
        `Cannot deactivate resource with ${upcomingCount} upcoming booking(s). Cancel them first.`
      );
    }

    await prisma.resource.update({
      where: { id },
      data:  { isActive: false },
    });

    return ok({ id }, `Resource "${resource.name}" deactivated`);
  } catch (error) {
    return serverError(error);
  }
}
