
// src/app/api/storefront/payments/verify/route.ts
// POST — verify Razorpay payment signature and confirm booking
// PUBLIC — no JWT needed

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body required');

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      slug,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return badRequest('Missing Razorpay payment details');
    }
    if (!bookingId) return badRequest('bookingId required');
    if (!slug)      return badRequest('slug required');

    // Verify HMAC signature
    const secret    = process.env.RAZORPAY_KEY_SECRET ?? '';
    const body_str  = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected  = crypto.createHmac('sha256', secret).update(body_str).digest('hex');

    if (expected !== razorpay_signature) {
      return badRequest('Invalid payment signature — possible tampering detected');
    }

    // Resolve tenant
    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true },
    });
    if (!tenant) return notFound('Tenant');

    // Load booking
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, tenantId: tenant.id },
    });
    if (!booking) return notFound('Booking');

    const newPaid     = booking.totalAmount; // mark as fully paid
    const newStatus   = 'CONFIRMED';
    const newRemaining = 0;

    // Update booking
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        paidAmount:      newPaid,
        remainingAmount: newRemaining,
        status:          newStatus,
      },
    });

    // Record payment
    await prisma.bookingPayment.create({
      data: {
        bookingId,
        tenantId:          tenant.id,
        amount:            booking.totalAmount - booking.paidAmount,
        method:            'RAZORPAY',
        status:            'completed',
        razorpayOrderId:   razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    return ok({
      success:   true,
      bookingId,
      status:    newStatus,
      paidAmount: newPaid,
      message:   'Payment verified and booking confirmed',
    });
  } catch (error) {
    return serverError(error);
  }
}
