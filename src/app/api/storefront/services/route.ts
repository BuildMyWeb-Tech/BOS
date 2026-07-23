// src/app/api/storefront/services/route.ts
// GET /api/storefront/services
//
// PUBLIC endpoint — no JWT required.
// Tenant resolved from X-Tenant-Slug header or ?slug= query param.
// Returns only active services for display on the public storefront.

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // ── Resolve tenant from slug ───────────────────────────────────
    const slug = request.headers.get('x-tenant-slug') ?? searchParams.get('slug') ?? null;

    if (!slug) return badRequest('Provide X-Tenant-Slug header or slug query param');

    const tenant = await prisma.tenant.findFirst({
      where: {
        slug:   { equals: slug, mode: 'insensitive' },
        status: 'APPROVED',
      },
      select: { id: true },
    });

    if (!tenant) return notFound('Tenant');

    // ── Fetch active services ──────────────────────────────────────
    const services = await prisma.service.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        // Include resource if your schema has a service→resource relation
        // resource: { select: { id: true, name: true, type: true } },
      },
    });

    return ok({
      services: services.map(s => ({
        id:          s.id,
        name:        s.name,
        description: s.description,
        duration:    s.duration,
        price:       s.price,
        image:       (s as any).image ?? null,
        category:    s.category,
        isActive:    s.isActive,
      })),
      total: services.length,
    });
  } catch (error) {
    return serverError(error);
  }
}
