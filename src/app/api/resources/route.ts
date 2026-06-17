// src/app/api/resources/route.ts
// GET  /api/resources — list resources for tenant
// POST /api/resources — create a resource (court, room, table, equipment)
//
// Permission: booking.view (GET), booking.create (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { resourceSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

// ─── GET /api/resources ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const type            = searchParams.get('type') ?? undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const resources = await prisma.resource.findMany({
      where: {
        tenantId: auth.tenantId,
        ...(!includeInactive && { isActive: true }),
        ...(type && { type }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { bookings: true } } },
    });

    return ok({
      resources: resources.map(r => ({
        id:           r.id,
        tenantId:     r.tenantId,
        name:         r.name,
        type:         r.type,
        description:  r.description,
        isActive:     r.isActive,
        bookingCount: r._count.bookings,
        createdAt:    r.createdAt,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/resources ─────────────────────────────────────────

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

    const { data, errors } = validate(resourceSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Unique name within tenant
    const existing = await prisma.resource.findFirst({
      where: { name: data.name, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (existing) return conflict(`Resource "${data.name}" already exists`);

    const resource = await prisma.resource.create({
      data: {
        tenantId:    auth.tenantId,
        name:        data.name,
        type:        data.type,
        description: data.description ?? null,
        isActive:    true,
      },
    });

    return created(
      {
        resource: {
          id:           resource.id,
          tenantId:     resource.tenantId,
          name:         resource.name,
          type:         resource.type,
          description:  resource.description,
          isActive:     resource.isActive,
          bookingCount: 0,
          createdAt:    resource.createdAt,
        },
      },
      `Resource "${resource.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
