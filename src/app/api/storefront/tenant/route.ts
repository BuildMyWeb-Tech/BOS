// src/app/api/storefront/tenant/route.ts
// GET /api/storefront/tenant?slug=buildmyweb
// Public endpoint — no auth required.
// Returns only public-safe fields + which modules the vendor has enabled.
//
// FIX: Removed `isActive: true` from the query.
// When a vendor is approved, status is set to 'APPROVED' but isActive may
// still be false (it is set independently). Using only status:'APPROVED'
// is the correct public safety gate — isActive controls dashboard login only.

import { NextRequest } from 'next/server';
import { ok, notFound, badRequest, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('slug');
    if (!slug) return badRequest('slug is required');

    // Try exact match first, then case-insensitive fallback
    // (slug in DB might be 'BuildMyWeb' but URL uses 'buildmyweb')
    let tenant = await prisma.tenant.findFirst({
      where: {
        slug,
        status: 'APPROVED',
        // REMOVED: isActive: true  ← this was blocking approved vendors
      },
      select: {
        id:           true,
        name:         true,
        slug:         true,
        businessType: true,
        description:  true,
        logo:         true,
        modules:      true,
        isActive:     true,
        status:       true,
      },
    });

    // Case-insensitive slug fallback — handles 'BuildMyWeb' vs 'buildmyweb'
    if (!tenant) {
      tenant = await prisma.tenant.findFirst({
        where: {
          slug:   { equals: slug, mode: 'insensitive' },
          status: 'APPROVED',
        },
        select: {
          id:           true,
          name:         true,
          slug:         true,
          businessType: true,
          description:  true,
          logo:         true,
          modules:      true,
          isActive:     true,
          status:       true,
        },
      });
    }

    if (!tenant) return notFound('Tenant');

    // Return only public-safe fields (exclude isActive/status from response)
    return ok({
      tenant: {
        id:           tenant.id,
        name:         tenant.name,
        slug:         tenant.slug,
        businessType: tenant.businessType,
        description:  tenant.description,
        logo:         tenant.logo,
        modules:      tenant.modules,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
