// src/app/api/storefront/services/[id]/route.ts
// GET /api/storefront/services/[id] — public service detail
// Used by the booking page to show service info + staff who can perform it.

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const slug = request.headers.get('x-tenant-slug') ?? request.nextUrl.searchParams.get('slug');
    if (!slug) return badRequest('X-Tenant-Slug header required');

    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true, name: true },
    });
    if (!tenant) return notFound('Tenant');

    const service = await prisma.service.findFirst({
      where:   { id, tenantId: tenant.id, isActive: true },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!service) return notFound('Service');

    // Find active staff (for staff picker on booking page)
    const staff = await prisma.staff.findMany({
      where:   { tenantId: tenant.id, isActive: true },
      include: { user: { select: { id: true, name: true } } },
      take:    20,
    });

    return ok({
      service: {
        id:          service.id,
        name:        service.name,
        description: service.description,
        duration:    service.duration,
        price:       service.price,
        image:       (service as any).image ?? null,
        category:    service.category,
      },
      staff: staff.map(s => ({
        id:   s.id,
        name: s.user.name,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
