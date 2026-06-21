// src/app/api/coupons/validate/route.ts
// POST /api/coupons/validate — check a coupon code before checkout
//
// Looks up tenant-specific coupon first, falls back to a platform-wide
// coupon (tenantId: null) with the same code if no tenant-specific match.
// isNewCustomer is determined by whether the customer has any prior
// non-cancelled orders. isMember is a placeholder (always false) since
// there's no membership concept in the schema yet.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { validateCouponSchema, validate } from '@/lib/validation';
import { checkCouponEligibility } from '@/lib/ecommerce/orderMath';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(validateCouponSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Tenant-specific coupon takes priority over a platform-wide one
    let coupon = await prisma.coupon.findFirst({
      where: { code: data.code, tenantId: auth.tenantId },
    });
    if (!coupon) {
      coupon = await prisma.coupon.findFirst({
        where: { code: data.code, tenantId: null },
      });
    }

    if (!coupon) {
      return ok({ valid: false, reason: 'Coupon code not found' });
    }

    const priorOrderCount = await prisma.order.count({
      where: { userId: auth.userId, tenantId: auth.tenantId, status: { not: 'CANCELLED' } },
    });

    const result = checkCouponEligibility({
      code:          coupon.code,
      discount:      coupon.discount,
      forNewUser:    coupon.forNewUser,
      forMember:     coupon.forMember,
      isPublic:      coupon.isPublic,
      expiresAt:     coupon.expiresAt,
      now:           new Date(),
      isNewCustomer: priorOrderCount === 0,
      isMember:      false,
      cartTotal:     data.cartTotal,
    });

    return ok(
      result.valid
        ? { valid: true, code: coupon.code, discount: coupon.discount, discountedTotal: result.discountedTotal }
        : { valid: false, reason: result.reason }
    );
  } catch (error) {
    return serverError(error);
  }
}
