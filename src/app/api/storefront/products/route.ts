// src/app/api/storefront/products/route.ts
// GET /api/storefront/products
//
// PUBLIC endpoint — no JWT required.
// Tenant is resolved from X-Tenant-Slug header (set by storefront page)
// OR from the authenticated JWT (for dashboard previews).
//
// FIX: Was calling authenticate() which requires a JWT.
// Storefront has no logged-in user → always returned 401 → 0 products shown.

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // ── Resolve tenant ────────────────────────────────────────────
    // Priority 1: X-Tenant-Slug header (storefront public access)
    // Priority 2: tenantId query param (internal/dashboard use)
    let tenantId: string | null = null;

    const slugHeader = request.headers.get('x-tenant-slug');
    const slugParam  = searchParams.get('slug');
    const slug       = slugHeader ?? slugParam ?? null;

    if (slug) {
      // Public lookup by slug — no auth needed
      const tenant = await prisma.tenant.findFirst({
        where: {
          slug:   { equals: slug, mode: 'insensitive' },
          status: 'APPROVED',
        },
        select: { id: true },
      });
      if (!tenant) return notFound('Tenant');
      tenantId = tenant.id;
    } else {
      // Fallback: try authenticated route (dashboard preview)
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const { authenticate } = await import('@/lib/api-helpers');
          const auth = await authenticate(request);
          if (!(auth instanceof Response) && auth.tenantId) {
            tenantId = auth.tenantId;
          }
        } catch { /* not authenticated — continue */ }
      }
    }

    if (!tenantId) {
      return badRequest('Provide X-Tenant-Slug header or slug query param');
    }

    // ── Filters ───────────────────────────────────────────────────
    const categoryId = searchParams.get('categoryId') ?? undefined;
    const search     = searchParams.get('search') ?? undefined;
    const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
    const skip       = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      isDeleted: false,
      ...(categoryId && { categoryId }),
    };

    if (search) {
      where.OR = [
        { name:        { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // ── Query ─────────────────────────────────────────────────────
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          variants: true,
          inventory: {
            where:  { tenantId },
            select: { quantity: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return ok({
      products: products.map(p => {
        const hasVariants    = p.variants.length > 0;
        const productInStock = hasVariants
          ? p.variants.some(v => v.stock > 0)
          : (p.inventory[0]?.quantity ?? 0) > 0;

        return {
          id:           p.id,
          name:         p.name,
          description:  p.description,
          mrp:          p.mrp,
          images:       p.images,
          categoryId:   p.categoryId,
          categoryName: p.category?.name ?? null,
          hasVariants,
          variants: p.variants.map(v => ({
            id:      v.id,
            size:    v.size,
            price:   v.price,
            inStock: v.stock > 0,
          })),
          inStock: productInStock,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
