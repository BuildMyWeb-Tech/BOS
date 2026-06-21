// src/app/api/storefront/products/route.ts
// GET /api/storefront/products — customer-facing product listing
//
// Requires authentication (any role) since the app has no anonymous
// browsing flow yet — tenant is resolved from the JWT, not a public
// subdomain lookup. Only returns non-deleted, in-stock-eligible products
// (out-of-stock items are still shown but flagged, matching typical
// storefront UX — a sold-out product page is still browsable).

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, serverError, parsePagination, paginationSkip } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);
    const categoryId = searchParams.get('categoryId') ?? undefined;

    const where: Prisma.ProductWhereInput = {
      tenantId:  auth.tenantId,
      isDeleted: false,
      ...(categoryId && { categoryId }),
    };

    if (pagination.search) {
      where.OR = [
        { name:        { contains: pagination.search, mode: 'insensitive' } },
        { description: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip:    paginationSkip(pagination),
        take:    pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category:  { select: { id: true, name: true } },
          variants:  true,
          inventory: { where: { tenantId: auth.tenantId }, select: { quantity: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: products.map(p => {
        const hasVariants = p.variants.length > 0;
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
            id: v.id, size: v.size, price: v.price, inStock: v.stock > 0,
          })),
          inStock: productInStock,
        };
      }),
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
