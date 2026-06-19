// src/app/api/products/[id]/route.ts
// GET    /api/products/[id] — full detail (variants, batches, stock)
// PATCH  /api/products/[id] — update product fields
// DELETE /api/products/[id] — soft delete (isDeleted: true)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, conflict, serverError,
} from '@/lib/api-helpers';
import { updateProductSchema, validate } from '@/lib/validation';
import { classifyStockStatus } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getProduct(id: string, tenantId: string) {
  return prisma.product.findFirst({
    where: { id, tenantId, isDeleted: false },
    include: {
      category:  { select: { id: true, name: true } },
      inventory: { where: { tenantId }, select: { quantity: true, lowStock: true } },
      variants:  true,
      batches:   { orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }] },
    },
  });
}

// ─── GET ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;
    const product = await getProduct(id, auth.tenantId);
    if (!product) return notFound('Product');

    const hasVariants = product.variants.length > 0;
    const totalStock = hasVariants
      ? product.variants.reduce((sum, v) => sum + v.stock, 0)
      : (product.inventory[0]?.quantity ?? 0);
    const lowStock = product.inventory[0]?.lowStock ?? 10;

    return ok({
      product: {
        id:           product.id,
        name:         product.name,
        description:  product.description,
        mrp:          product.mrp,
        images:       product.images,
        categoryId:   product.categoryId,
        categoryName: product.category?.name ?? null,
        sku:          product.sku,
        keyFeatures:  product.keyFeatures,
        inStock:      product.inStock,
        hasVariants,
        totalStock,
        lowStock,
        stockStatus:  classifyStockStatus(totalStock, lowStock),
        variants: product.variants.map(v => ({
          id: v.id, productId: v.productId, size: v.size, price: v.price,
          barcode: v.barcode, stock: v.stock,
        })),
        batches: product.batches.map(b => ({
          id: b.id, productId: b.productId, variantId: b.variantId,
          batchNumber: b.batchNumber, expiryDate: b.expiryDate,
          quantity: b.quantity, remainingQty: b.remainingQty, createdAt: b.createdAt,
        })),
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── PATCH ────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canEdit =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('product.edit');
    if (!canEdit) return forbidden('Missing permission: product.edit');

    const { id } = await params;
    const product = await getProduct(id, auth.tenantId);
    if (!product) return notFound('Product');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateProductSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    if (data.sku && data.sku !== product.sku) {
      const dupe = await prisma.product.findFirst({
        where: { sku: data.sku, tenantId: auth.tenantId, isDeleted: false, id: { not: id } },
        select: { id: true },
      });
      if (dupe) return conflict(`A product with SKU "${data.sku}" already exists`);
    }

    if (data.categoryId) {
      const cat = await prisma.productCategory.findFirst({
        where: { id: data.categoryId, tenantId: auth.tenantId },
        select: { id: true },
      });
      if (!cat) return badRequest('Category not found');
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(data.name        !== undefined && { name:        data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.mrp         !== undefined && { mrp:         data.mrp }),
        ...(data.images      !== undefined && { images:      data.images }),
        ...(data.categoryId  !== undefined && { categoryId:  data.categoryId }),
        ...(data.sku         !== undefined && { sku:         data.sku }),
        ...(data.keyFeatures !== undefined && { keyFeatures: data.keyFeatures }),
        ...(data.inStock     !== undefined && { inStock:     data.inStock }),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return ok(
      {
        product: {
          id:           updated.id,
          name:         updated.name,
          description:  updated.description,
          mrp:          updated.mrp,
          images:       updated.images,
          categoryId:   updated.categoryId,
          categoryName: updated.category?.name ?? null,
          sku:          updated.sku,
          keyFeatures:  updated.keyFeatures,
          inStock:      updated.inStock,
          updatedAt:    updated.updatedAt,
        },
      },
      'Product updated'
    );
  } catch (error) {
    return serverError(error);
  }
}

// ─── DELETE (soft) ────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canDelete =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('product.delete');
    if (!canDelete) return forbidden('Missing permission: product.delete');

    const { id } = await params;
    const product = await getProduct(id, auth.tenantId);
    if (!product) return notFound('Product');

    await prisma.product.update({
      where: { id },
      data:  { isDeleted: true },
    });

    return ok({ id }, `Product "${product.name}" deleted`);
  } catch (error) {
    return serverError(error);
  }
}
