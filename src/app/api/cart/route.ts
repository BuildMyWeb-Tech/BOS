// src/app/api/cart/route.ts
// GET /api/cart — get the authenticated customer's cart
//
// Auto-creates an empty cart on first access (every customer always
// has exactly one cart, lazily materialized). Each item is annotated
// with `available: false` if current stock no longer covers the
// requested quantity, so the UI can warn before checkout fails.

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true, name: true, images: true, mrp: true,
        },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    let cart = await prisma.cart.findUnique({
      where:   { userId: auth.userId },
      include: CART_INCLUDE,
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data:    { tenantId: auth.tenantId, userId: auth.userId },
        include: CART_INCLUDE,
      });
    }

    // Inventory is tenant-scoped, so fetch it separately rather than
    // through the nested include (which can't filter by tenantId per row
    // when also typed generically via CART_INCLUDE above).
    const productIds = cart.items.map(i => i.productId);
    const inventoryRows = productIds.length > 0
      ? await prisma.inventory.findMany({
          where:  { productId: { in: productIds }, tenantId: auth.tenantId },
          select: { productId: true, quantity: true },
        })
      : [];
    const inventoryMap = new Map(inventoryRows.map(r => [r.productId, r.quantity]));

    // Resolve variant prices/stock for items that have one
    const variantIds = cart.items
      .filter((i): i is typeof i & { variantId: string } => i.variantId !== null)
      .map(i => i.variantId);
    const variants = variantIds.length > 0
      ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const variantMap = new Map(variants.map(v => [v.id, v]));

    const items = cart.items.map(item => {
      const variant   = item.variantId ? variantMap.get(item.variantId) : undefined;
      const unitPrice = variant ? variant.price : item.product.mrp;
      const availableStock = variant ? variant.stock : (inventoryMap.get(item.productId) ?? 0);

      return {
        id:           item.id,
        productId:    item.productId,
        productName:  item.product.name,
        productImage: item.product.images[0] ?? null,
        variantId:    item.variantId,
        variantSize:  variant?.size ?? null,
        unitPrice,
        quantity:     item.quantity,
        lineTotal:    Math.round(unitPrice * item.quantity * 100) / 100,
        available:    availableStock >= item.quantity,
      };
    });

    const subtotal = Math.round(
      items.reduce((sum, i) => sum + i.lineTotal, 0) * 100
    ) / 100;

    return ok({
      cart: {
        id:        cart.id,
        items,
        itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
        subtotal,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
