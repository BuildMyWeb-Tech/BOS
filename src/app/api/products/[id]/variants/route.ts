// src/app/api/products/[id]/variants/route.ts
// POST /api/products/[id]/variants — add a variant to an existing product
//
// Permission: product.edit

import { NextRequest } from 'next/server';
import { authenticate, created, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api-helpers';
import { addVariantSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canEdit =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('product.edit');
    if (!canEdit) return forbidden('Missing permission: product.edit');

    const { id: productId } = await params;
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: auth.tenantId, isDeleted: false },
    });
    if (!product) return notFound('Product');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(addVariantSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const dupe = await prisma.productVariant.findFirst({
      where: { productId, size: data.size },
      select: { id: true },
    });
    if (dupe) return conflict(`A variant with size "${data.size}" already exists for this product`);

    if (data.barcode) {
      const barcodeDupe = await prisma.productVariant.findFirst({
        where: { barcode: data.barcode },
        select: { id: true },
      });
      if (barcodeDupe) return conflict(`Barcode "${data.barcode}" is already in use`);
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        size:    data.size,
        price:   data.price,
        barcode: data.barcode ?? null,
        stock:   0,
      },
    });

    return created(
      {
        variant: {
          id: variant.id, productId: variant.productId, size: variant.size,
          price: variant.price, barcode: variant.barcode, stock: variant.stock,
        },
      },
      `Variant "${variant.size}" added`
    );
  } catch (error) {
    return serverError(error);
  }
}
