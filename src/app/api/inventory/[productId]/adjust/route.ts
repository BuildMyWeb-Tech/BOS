// src/app/api/inventory/[productId]/adjust/route.ts
// PATCH /api/inventory/[productId]/adjust — manual stock adjustment
//
// delta > 0: adds a new ProductBatch (reason: "correction"/"returned"/"other")
//   — treated as a stock receipt, same Inventory sync as the batches endpoint.
// delta < 0: deducts from existing batches in FEFO order (reason: "damaged"/"lost"/"other")
//   — cannot remove more than what's currently on hand; over-removal is
//     rejected outright (not silently clamped) so the staff member knows
//     their adjustment didn't match reality.
//
// Permission: inventory.manage

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { adjustInventorySchema, validate } from '@/lib/validation';
import { allocateFefoDeduction } from '@/lib/inventory/stockSync';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ productId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('inventory.manage');
    if (!canManage) return forbidden('Missing permission: inventory.manage');

    const { productId } = await params;
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId, isDeleted: false },
    });
    if (!product) return notFound('Product');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(adjustInventorySchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const inventory = await prisma.inventory.findUnique({
      where: { productId_tenantId: { productId, tenantId: auth.tenantId } },
    });

    if (data.delta > 0) {
      // Positive adjustment: record as a new batch (no expiry, no variant —
      // this is a generic correction/return, not a proper stock receipt
      // with batch tracking; use the batches endpoint for that).
      const result = await prisma.$transaction(async (tx) => {
        const batch = await tx.productBatch.create({
          data: {
            productId,
            variantId:    null,
            batchNumber:  `ADJ-${Date.now()}`,
            quantity:     data.delta,
            remainingQty: data.delta,
          },
        });

        const updatedInventory = await tx.inventory.upsert({
          where:  { productId_tenantId: { productId, tenantId: auth.tenantId! } },
          create: { productId, tenantId: auth.tenantId!, quantity: data.delta, lowStock: 10 },
          update: { quantity: { increment: data.delta } },
        });

        await tx.product.update({ where: { id: productId }, data: { inStock: true } });

        return { batch, inventory: updatedInventory };
      });

      return ok(
        {
          productId,
          delta:        data.delta,
          reason:       data.reason,
          newQuantity:  result.inventory.quantity,
        },
        `Stock increased by ${data.delta} (${data.reason})`
      );
    }

    // Negative adjustment: deduct from existing batches in FEFO order
    const removeQty = Math.abs(data.delta);
    const currentQuantity = inventory?.quantity ?? 0;

    if (removeQty > currentQuantity) {
      return badRequest(
        `Cannot remove ${removeQty} units — only ${currentQuantity} currently in stock`
      );
    }

    const batches = await prisma.productBatch.findMany({
      where: { productId, remainingQty: { gt: 0 } },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }], // FEFO
      select: { id: true, remainingQty: true },
    });

    const { deductions, shortfall } = allocateFefoDeduction(batches, removeQty);

    if (shortfall > 0) {
      // Batches don't actually have enough even though Inventory said they did —
      // data has drifted. Surface this rather than silently under-deducting.
      return badRequest(
        `Inventory record and batch records are out of sync — could not allocate ${shortfall} unit(s). Please reconcile batches.`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const d of deductions) {
        await tx.productBatch.update({
          where: { id: d.batchId },
          data:  { remainingQty: { decrement: d.deduct } },
        });
      }

      const updatedInventory = await tx.inventory.update({
        where: { productId_tenantId: { productId, tenantId: auth.tenantId! } },
        data:  { quantity: { decrement: removeQty } },
      });

      // Flip inStock off if this zeroed out the product (no-variant products only —
      // variant-level inStock isn't tracked separately in this schema)
      if (updatedInventory.quantity <= 0) {
        await tx.product.update({ where: { id: productId }, data: { inStock: false } });
      }

      return updatedInventory;
    });

    return ok(
      {
        productId,
        delta:       data.delta,
        reason:      data.reason,
        newQuantity: result.quantity,
      },
      `Stock decreased by ${removeQty} (${data.reason})`
    );
  } catch (error) {
    return serverError(error);
  }
}
