// src/app/api/storefront/categories/route.ts
// GET — public product categories for storefront filter tabs.

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const slug = request.headers.get('x-tenant-slug')
               ?? request.nextUrl.searchParams.get('slug');
    if (!slug) return badRequest('X-Tenant-Slug header or slug param required');

    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true },
    });
    if (!tenant) return notFound('Tenant');

    const categories = await prisma.productCategory.findMany({
      where:   { tenantId: tenant.id },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { isDeleted: false } } } } },
    });

    return ok({
      categories: categories.map(c => ({
        id:           c.id,
        name:         c.name,
        description:  c.description,
        image:        c.image,
        productCount: c._count.products,
        createdAt:    c.createdAt,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}