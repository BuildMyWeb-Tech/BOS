// src/app/api/products/[id]/variants/[variantId]/route.ts
// PATCH /api/products/[id]/variants/[variantId] — update size/price/barcode
//
// Permission: product.edit
// Stock (the `stock` field) is NEVER updated here — that's exclusively
// managed via batches/adjustments to keep one source of truth.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api-helpers';
import { updateVariantSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string; variantId: string }> };

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

    const { id: productId, variantId } = await params;

    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId, isDeleted: false },
      select: { id: true },
    });
    if (!product) return notFound('Product');

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) return notFound('Variant');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateVariantSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    if (data.size && data.size !== variant.size) {
      const dupe = await prisma.productVariant.findFirst({
        where: { productId, size: data.size, id: { not: variantId } },
        select: { id: true },
      });
      if (dupe) return conflict(`A variant with size "${data.size}" already exists for this product`);
    }

    if (data.barcode && data.barcode !== variant.barcode) {
      const barcodeDupe = await prisma.productVariant.findFirst({
        where: { barcode: data.barcode, id: { not: variantId } },
        select: { id: true },
      });
      if (barcodeDupe) return conflict(`Barcode "${data.barcode}" is already in use`);
    }

    const updated = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        ...(data.size    !== undefined && { size:    data.size }),
        ...(data.price   !== undefined && { price:   data.price }),
        ...(data.barcode !== undefined && { barcode: data.barcode }),
      },
    });

    return ok(
      {
        variant: {
          id: updated.id, productId: updated.productId, size: updated.size,
          price: updated.price, barcode: updated.barcode, stock: updated.stock,
        },
      },
      'Variant updated'
    );
  } catch (error) {
    return serverError(error);
  }
}
