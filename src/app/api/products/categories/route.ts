// src/app/api/products/categories/route.ts
// GET  /api/products/categories — list categories for the tenant
// POST /api/products/categories — create a new category
//
// Permission: inventory.view (GET), inventory.manage or product.create (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
} from '@/lib/api-helpers';
import { productCategorySchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const categories = await prisma.productCategory.findMany({
      where:   { tenantId: auth.tenantId },
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

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canCreate =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('product.create') ||
      auth.permissions.includes('inventory.manage');
    if (!canCreate) return forbidden('Missing permission: product.create');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(productCategorySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const existing = await prisma.productCategory.findFirst({
      where: { name: data.name, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (existing) return conflict(`Category "${data.name}" already exists`);

    const category = await prisma.productCategory.create({
      data: {
        tenantId:    auth.tenantId,
        name:        data.name,
        description: data.description ?? '',
        image:       data.image ?? '',
        createdBy:   'TENANT',
      },
    });

    return created(
      {
        category: {
          id:           category.id,
          name:         category.name,
          description:  category.description,
          image:        category.image,
          productCount: 0,
          createdAt:    category.createdAt,
        },
      },
      `Category "${category.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
