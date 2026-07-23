// src/app/api/storefront/availability/route.ts
// GET /api/storefront/availability?slug=buildmyweb&serviceId=X&date=YYYY-MM-DD
// PUBLIC — no auth needed. Used by the customer-facing booking page.

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import { getAvailableSlots } from '@/lib/booking/slotEngine';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const slug      = request.headers.get('x-tenant-slug') ?? searchParams.get('slug');
    const serviceId = searchParams.get('serviceId');
    const date      = searchParams.get('date');
    const staffId   = searchParams.get('staffId') ?? null;

    if (!slug)      return badRequest('slug is required');
    if (!serviceId) return badRequest('serviceId is required');
    if (!date)      return badRequest('date is required (YYYY-MM-DD)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('date must be YYYY-MM-DD');

    // Resolve tenant
    const tenant = await prisma.tenant.findFirst({
      where: { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true },
    });
    if (!tenant) return notFound('Tenant');

    const result = await getAvailableSlots({
      tenantId:  tenant.id,
      date,
      serviceId,
      staffId,
    });

    return ok({ availability: result });
  } catch (error) {
    return serverError(error);
  }
}
