// src/app/api/webhooks/razorpay/route.ts
// POST /api/webhooks/razorpay
//
// Razorpay sends this after every payment event (captured / failed).
// This completes the flow that /api/bookings/[id]/payment started:
//   1. Customer-side code creates a Razorpay order, calls our /payment
//      endpoint which records a BookingPayment with status:"pending"
//   2. Customer pays on Razorpay's checkout
//   3. Razorpay POSTs this webhook — we verify the signature, find the
//      pending payment, and either confirm or fail the booking
//
// Security: HMAC-SHA256 signature verified before any DB read/write.
// Idempotency: we check payment.status before updating so repeated
//   delivery of the same webhook is safe.

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  verifyRazorpaySignature,
  parseWebhookPayload,
  isHandledEvent,
} from '@/lib/razorpay';
import { calculateRequiredAdvance, applyPayment } from '@/lib/booking/bookingMath';

// Razorpay requires a 200 response quickly — even for events we skip.
// Any non-2xx causes Razorpay to retry (up to 24 hours, exponential back-off).
function ack(message = 'ok'): NextResponse {
  return NextResponse.json({ received: true, message }, { status: 200 });
}

function reject(message: string): NextResponse {
  return NextResponse.json({ received: false, message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  // ── 1. Read raw body (must be done before any .json() call) ─────
  const rawBody = await request.text();

  // ── 2. Verify signature ──────────────────────────────────────────
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const secret    = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  if (!secret) {
    console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not set');
    return reject('Webhook secret not configured');
  }

  if (!verifyRazorpaySignature(rawBody, signature, secret)) {
    console.warn('[Razorpay Webhook] Invalid signature — possible spoofed request');
    return reject('Invalid signature');
  }

  // ── 3. Parse payload ─────────────────────────────────────────────
  const payload = parseWebhookPayload(rawBody);
  if (!payload) {
    return reject('Malformed payload');
  }

  const { event } = payload;

  // Acknowledge events we don't handle (refunds, disputes, etc.)
  if (!isHandledEvent(event)) {
    return ack(`Event ${event} acknowledged but not processed`);
  }

  const entity       = payload.payload.payment.entity;
  const razorpayPmtId = entity.id;
  const razorpayOrdId = entity.order_id;

  // ── 4. Find the pending BookingPayment ───────────────────────────
  const bookingPayment = await prisma.bookingPayment.findUnique({
    where:   { razorpayPaymentId: razorpayPmtId },
    include: { booking: true },
  });

  if (!bookingPayment) {
    // Could be a payment not initiated through BOS — acknowledge and skip
    console.warn(`[Razorpay Webhook] No BookingPayment found for payment_id=${razorpayPmtId}`);
    return ack('Payment not found in BOS — skipped');
  }

  // Idempotency: already processed
  if (bookingPayment.status !== 'pending') {
    return ack(`Already processed (status=${bookingPayment.status})`);
  }

  const booking = bookingPayment.booking;

  // ── 5. Handle payment.captured ───────────────────────────────────
  if (event === 'payment.captured') {
    const slotConfig = await prisma.slotConfig.findUnique({
      where: { tenantId: booking.tenantId },
    });

    const requiredAdvance = calculateRequiredAdvance(
      booking.totalAmount,
      slotConfig?.advancePaymentRequired ?? true,
      slotConfig?.advancePaymentPercent  ?? 100
    );

    const result = applyPayment({
      currentPaidAmount: booking.paidAmount,
      totalAmount:       booking.totalAmount,
      requiredAdvance,
      paymentAmount:     bookingPayment.amount,
    });

    await prisma.$transaction([
      // Mark the payment as completed
      prisma.bookingPayment.update({
        where: { id: bookingPayment.id },
        data:  { status: 'completed' },
      }),
      // Update the booking financial state
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paidAmount:      result.newPaidAmount,
          remainingAmount: result.newRemainingAmount,
          status:
            booking.status === 'COMPLETED' ? 'COMPLETED' : result.newStatus,
        },
      }),
    ]);

    console.info(
      `[Razorpay Webhook] payment.captured — bookingId=${booking.id} ` +
      `paidAmount=${result.newPaidAmount} newStatus=${result.newStatus}`
    );

    return ack('Payment captured and booking updated');
  }

  // ── 6. Handle payment.failed ─────────────────────────────────────
  if (event === 'payment.failed') {
    await prisma.bookingPayment.update({
      where: { id: bookingPayment.id },
      data:  { status: 'failed' },
    });

    console.info(
      `[Razorpay Webhook] payment.failed — bookingId=${booking.id} ` +
      `error=${entity.error_code}: ${entity.error_description}`
    );

    // Booking status stays PENDING_PAYMENT — customer can retry
    return ack('Payment failure recorded');
  }

  return ack('No action taken');
}
