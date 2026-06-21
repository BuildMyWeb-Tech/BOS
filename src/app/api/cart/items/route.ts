// src/app/api/cart/items/route.ts
// POST /api/cart/items — add an item to the cart
//
// If the same productId+variantId combo is already in the cart, the
// quantity is added to the existing line (not duplicated) — matches
// the @@unique([cartId, productId, variantId]) constraint on CartItem.

import { NextRequest } from 'next/server';
import { authenticate, created, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { addCartItemSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(addCartItemSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const product = await prisma.product.findFirst({
      where: { id: data.productId, tenantId: auth.tenantId, isDeleted: false },
    });
    if (!product) return notFound('Product');

    if (data.variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: { id: data.variantId, productId: data.productId },
      });
      if (!variant) return badRequest('Variant not found for this product');
    }

    const cart = await prisma.cart.upsert({
      where:  { userId: auth.userId },
      create: { tenantId: auth.tenantId, userId: auth.userId },
      update: {},
    });

    const existing = await prisma.cartItem.findUnique({
      where: {
        cartId_productId_variantId: {
          cartId:    cart.id,
          productId: data.productId,
          variantId: data.variantId ?? null,
        },
      },
    });

    const item = existing
      ? await prisma.cartItem.update({
          where: { id: existing.id },
          data:  { quantity: existing.quantity + data.quantity },
        })
      : await prisma.cartItem.create({
          data: {
            cartId:    cart.id,
            productId: data.productId,
            variantId: data.variantId ?? null,
            quantity:  data.quantity,
          },
        });

    return created(
      { item: { id: item.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity } },
      'Item added to cart'
    );
  } catch (error) {
    return serverError(error);
  }
}
