// src/app/api/bills/[id]/void/route.ts
// POST /api/bills/[id]/void — void a bill
//
// Restores stock to the EXACT batches each BillItem drew from (using
// BillItem.batchId), reverses the Inventory/variant.stock counters,
// and removes the associated Sale record so revenue reporting stays accurate.
//
// Only allowed within VOID_WINDOW_MINUTES of creation, and only by
// staff/owner — this is a till-correction mechanism for immediate
// mistakes (wrong item rung up, customer changed their mind on the spot),
// not a general refund/return flow.
//
// Permission: billing.refund

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

const VOID_WINDOW_MINUTES = 30;

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canVoid =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('billing.refund');
    if (!canVoid) return forbidden('Missing permission: billing.refund');

    const { id } = await params;

    const bill = await prisma.bill.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { items: true },
    });
    if (!bill) return notFound('Bill');

    const minutesSinceCreation = (Date.now() - bill.createdAt.getTime()) / (1000 * 60);
    if (minutesSinceCreation > VOID_WINDOW_MINUTES) {
      return badRequest(
        `Bills can only be voided within ${VOID_WINDOW_MINUTES} minutes of creation. This bill was created ${Math.round(minutesSinceCreation)} minute(s) ago.`
      );
    }

    // Re-aggregate per product/variant so we restore the right total to
    // Inventory/variant.stock (each BillItem already carries its own batchId
    // and quantity slice from the original FEFO split).
    const productTotals = new Map<string, number>(); // productId -> total qty to restore
    const variantTotals = new Map<string, number>(); // variantId -> total qty to restore

    await prisma.$transaction(async (tx) => {
      for (const item of bill.items) {
        if (item.batchId) {
          await tx.productBatch.update({
            where: { id: item.batchId },
            data:  { remainingQty: { increment: item.quantity } },
          });
        }

        productTotals.set(item.productId, (productTotals.get(item.productId) ?? 0) + item.quantity);
        if (item.variantId) {
          variantTotals.set(item.variantId, (variantTotals.get(item.variantId) ?? 0) + item.quantity);
        }
      }

      for (const [productId, qty] of productTotals.entries()) {
        await tx.inventory.update({
          where: { productId_tenantId: { productId, tenantId: auth.tenantId! } },
          data:  { quantity: { increment: qty } },
        });
        // Restore inStock flag since stock is back
        await tx.product.update({ where: { id: productId }, data: { inStock: true } });
      }

      for (const [variantId, qty] of variantTotals.entries()) {
        await tx.productVariant.update({
          where: { id: variantId },
          data:  { stock: { increment: qty } },
        });
      }

      // Remove the associated Sale record so revenue reports stay accurate
      await tx.sale.deleteMany({
        where: { tenantId: auth.tenantId!, source: 'BILLING', referenceId: bill.id },
      });

      // Delete the bill itself along with its items (BillItem cascades on Bill delete)
      await tx.bill.delete({ where: { id } });
    });

    return ok(
      { id, billNumber: bill.billNumber, restoredItemCount: bill.items.length },
      `Bill ${bill.billNumber} voided and stock restored`
    );
  } catch (error) {
    return serverError(error);
  }
}
