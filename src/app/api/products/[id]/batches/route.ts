// src/app/api/products/[id]/batches/route.ts
// POST /api/products/[id]/batches — receive new stock
//
// Creates a ProductBatch and synchronously updates the denormalized
// stock counters in the same transaction:
//   - If variantId given: ProductVariant.stock += quantity
//   - Inventory.quantity (tenant-scoped product total) += quantity
//     (upserts the Inventory row if it doesn't exist yet)
//
// Permission: inventory.manage or product.edit

import { NextRequest } from 'next/server';
import { authenticate, created, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { createBatchSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('inventory.manage') ||
      auth.permissions.includes('product.edit');
    if (!canManage) return forbidden('Missing permission: inventory.manage');

    const { id: productId } = await params;
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId, isDeleted: false },
    });
    if (!product) return notFound('Product');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(createBatchSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Validate variant belongs to this product, if provided
    if (data.variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: data.variantId, productId },
      });
      if (!variant) return badRequest('Variant not found for this product');
    }

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.create({
        data: {
          productId,
          variantId:    data.variantId ?? null,
          batchNumber:  data.batchNumber ?? null,
          expiryDate:   data.expiryDate ? new Date(data.expiryDate) : null,
          quantity:     data.quantity,
          remainingQty: data.quantity,
        },
      });

      // Sync variant.stock if this batch is for a specific variant
      if (data.variantId) {
        await tx.productVariant.update({
          where: { id: data.variantId },
          data:  { stock: { increment: data.quantity } },
        });
      }

      // Sync Inventory.quantity — upsert since the row may not exist yet
      // for products created before this batch (or variant-only products
      // receiving their first stock).
      await tx.inventory.upsert({
        where: { productId_tenantId: { productId, tenantId: auth.tenantId! } },
        create: {
          productId,
          tenantId: auth.tenantId!,
          quantity: data.quantity,
          lowStock: 10,
        },
        update: {
          quantity: { increment: data.quantity },
        },
      });

      // Ensure inStock flag reflects reality
      await tx.product.update({
        where: { id: productId },
        data:  { inStock: true },
      });

      return batch;
    });

    return created(
      {
        batch: {
          id: result.id, productId: result.productId, variantId: result.variantId,
          batchNumber: result.batchNumber, expiryDate: result.expiryDate,
          quantity: result.quantity, remainingQty: result.remainingQty,
          createdAt: result.createdAt,
        },
      },
      `Received ${data.quantity} units`
    );
  } catch (error) {
    return serverError(error);
  }
}
