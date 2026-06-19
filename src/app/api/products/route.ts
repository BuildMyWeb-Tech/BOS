// src/app/api/products/route.ts
// GET  /api/products — list products (search, category, stock status filters)
// POST /api/products — create a product, optionally with variants and/or initial stock
//
// Permission: product.view (GET), product.create (POST)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { createProductSchema, productListQuerySchema, validate } from '@/lib/validation';
import { classifyStockStatus } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { StockStatus } from '@/types';

// ─── GET /api/products ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);

    const { data, errors } = validate(productListQuerySchema, {
      categoryId:  searchParams.get('categoryId')  ?? undefined,
      stockStatus: searchParams.get('stockStatus') ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const where: Prisma.ProductWhereInput = {
      tenantId:  auth.tenantId,
      isDeleted: false,
      ...(data.categoryId && { categoryId: data.categoryId }),
    };

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { sku:  { contains: pagination.search, mode: 'insensitive' } },
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
          inventory: { where: { tenantId: auth.tenantId }, select: { quantity: true, lowStock: true } },
          variants:  { select: { stock: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    let items = products.map(p => {
      const hasVariants = p.variants.length > 0;
      const totalStock = hasVariants
        ? p.variants.reduce((sum, v) => sum + v.stock, 0)
        : (p.inventory[0]?.quantity ?? 0);
      const lowStock = p.inventory[0]?.lowStock ?? 10;
      const stockStatus = classifyStockStatus(totalStock, lowStock);

      return {
        id:           p.id,
        name:         p.name,
        mrp:          p.mrp,
        images:       p.images,
        categoryId:   p.categoryId,
        categoryName: p.category?.name ?? null,
        sku:          p.sku,
        inStock:      p.inStock,
        hasVariants,
        totalStock,
        lowStock,
        stockStatus,
        createdAt:    p.createdAt,
      };
    });

    // Stock status filter is applied post-query since it's derived, not a column
    if (data.stockStatus) {
      items = items.filter(i => i.stockStatus === data.stockStatus);
    }

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items,
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/products ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canCreate =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('product.create');
    if (!canCreate) return forbidden('Missing permission: product.create');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(createProductSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // SKU uniqueness check (only if provided — schema allows omission)
    if (data.sku) {
      const existingSku = await prisma.product.findFirst({
        where: { sku: data.sku, tenantId: auth.tenantId, isDeleted: false },
        select: { id: true },
      });
      if (existingSku) return conflict(`A product with SKU "${data.sku}" already exists`);
    }

    // Validate category belongs to tenant, if provided
    if (data.categoryId) {
      const cat = await prisma.productCategory.findFirst({
        where: { id: data.categoryId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!cat) return badRequest('Category not found');
    }

    const hasVariants = !!(data.variants && data.variants.length > 0);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId:    auth.tenantId!,
          name:        data.name,
          description: data.description ?? '',
          mrp:         data.mrp ?? 0,
          images:      data.images ?? [],
          categoryId:  data.categoryId ?? null,
          sku:         data.sku ?? null,
          keyFeatures: data.keyFeatures ?? [],
          createdBy:   'TENANT',
          inStock:     true,
        },
      });

      // Create variants, if provided
      if (hasVariants) {
        await tx.productVariant.createMany({
          data: data.variants!.map(v => ({
            productId: created.id,
            size:      v.size,
            price:     v.price,
            barcode:   v.barcode ?? null,
            stock:     0, // populated by batch creation below
          })),
        });
      }

      // Create initial stock batch for a no-variant product
      if (!hasVariants && data.initialQuantity && data.initialQuantity > 0) {
        await tx.productBatch.create({
          data: {
            productId:    created.id,
            variantId:    null,
            quantity:     data.initialQuantity,
            remainingQty: data.initialQuantity,
          },
        });

        await tx.inventory.create({
          data: {
            productId: created.id,
            tenantId:  auth.tenantId!,
            quantity:  data.initialQuantity,
            lowStock:  data.lowStockThreshold ?? 10,
          },
        });
      } else if (!hasVariants) {
        // No initial stock provided — still create the Inventory row at 0
        // so low-stock/out-of-stock reporting works from day one.
        await tx.inventory.create({
          data: {
            productId: created.id,
            tenantId:  auth.tenantId!,
            quantity:  0,
            lowStock:  data.lowStockThreshold ?? 10,
          },
        });
      }

      return created;
    });

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category:  { select: { id: true, name: true } },
        inventory: { where: { tenantId: auth.tenantId }, select: { quantity: true, lowStock: true } },
        variants:  true,
      },
    });

    const totalStock = hasVariants
      ? fullProduct!.variants.reduce((sum, v) => sum + v.stock, 0)
      : (fullProduct!.inventory[0]?.quantity ?? 0);
    const lowStock = fullProduct!.inventory[0]?.lowStock ?? 10;

    return created(
      {
        product: {
          id:           fullProduct!.id,
          name:         fullProduct!.name,
          description:  fullProduct!.description,
          mrp:          fullProduct!.mrp,
          images:       fullProduct!.images,
          categoryId:   fullProduct!.categoryId,
          categoryName: fullProduct!.category?.name ?? null,
          sku:          fullProduct!.sku,
          keyFeatures:  fullProduct!.keyFeatures,
          inStock:      fullProduct!.inStock,
          hasVariants,
          totalStock,
          lowStock,
          stockStatus:  classifyStockStatus(totalStock, lowStock) as StockStatus,
          variants:     fullProduct!.variants,
          createdAt:    fullProduct!.createdAt,
        },
      },
      `Product "${fullProduct!.name}" created`
    );
  } catch (error) {
    return serverError(error);
  }
}
