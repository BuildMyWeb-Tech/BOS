// src/app/api/cart/items/[id]/route.ts
// PATCH  /api/cart/items/[id] — update quantity
// DELETE /api/cart/items/[id] — remove item from cart
//
// [id] is CartItem.id. Always scoped to the authenticated user's own cart.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { updateCartItemSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

async function getOwnCartItem(itemId: string, userId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: { select: { userId: true } } },
  });
  if (!item || item.cart.userId !== userId) return null;
  return item;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const item = await getOwnCartItem(id, auth.userId);
    if (!item) return notFound('Cart item');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateCartItemSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const updated = await prisma.cartItem.update({
      where: { id },
      data:  { quantity: data.quantity },
    });

    return ok(
      { item: { id: updated.id, quantity: updated.quantity } },
      'Cart item updated'
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    const item = await getOwnCartItem(id, auth.userId);
    if (!item) return notFound('Cart item');

    await prisma.cartItem.delete({ where: { id } });

    return ok({ id }, 'Item removed from cart');
  } catch (error) {
    return serverError(error);
  }
}
