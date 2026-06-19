// src/app/api/bookings/[id]/payment/route.ts
// POST /api/bookings/[id]/payment
//
// Records a payment against a booking.
//   - cash/upi/card: confirmed synchronously (no async gateway involved
//     in this phase — these represent in-person/manual payment recording
//     by staff, or a simplified non-gateway customer flow)
//   - razorpay: created with status "pending" — a future webhook phase
//     will flip it to "completed" after signature verification. The
//     booking's paidAmount/status are NOT updated for razorpay payments
//     here; that happens when the webhook confirms it.
//
// Applies applyPayment() math to update Booking.paidAmount/remainingAmount/status.

import { NextRequest } from 'next/server';
import { authenticate, ok, created, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api-helpers';
import { recordPaymentSchema, validate } from '@/lib/validation';
import { calculateRequiredAdvance, applyPayment } from '@/lib/booking/bookingMath';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;

    const booking = await prisma.booking.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!booking) return notFound('Booking');

    const isOwnBooking = booking.customerId === auth.userId;
    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('billing.create');

    if (!isOwnBooking && !isPrivileged) {
      return forbidden('You do not have permission to record a payment for this booking');
    }

    if (booking.status === 'CANCELLED') return badRequest('Cannot pay for a cancelled booking');
    if (booking.status === 'COMPLETED' && booking.remainingAmount <= 0) {
      return badRequest('This booking is already fully paid');
    }

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(recordPaymentSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    if (data.amount > booking.remainingAmount + 0.01) { // small epsilon for float safety
      return badRequest(`Payment amount exceeds remaining balance of ${booking.remainingAmount}`);
    }

    // Razorpay payments: replay-attack guard on razorpayPaymentId uniqueness,
    // recorded as pending — booking is NOT updated until webhook confirmation.
    if (data.method === 'razorpay') {
      const existing = await prisma.bookingPayment.findUnique({
        where: { razorpayPaymentId: data.razorpayPaymentId },
      });
      if (existing) return conflict('This payment has already been recorded');

      const payment = await prisma.bookingPayment.create({
        data: {
          bookingId:          booking.id,
          amount:             data.amount,
          method:             data.method,
          razorpayOrderId:    data.razorpayOrderId,
          razorpayPaymentId:  data.razorpayPaymentId,
          status:             'pending',
        },
      });

      return created(
        { payment: { id: payment.id, status: payment.status, amount: payment.amount } },
        'Payment recorded — awaiting confirmation'
      );
    }

    // Cash / UPI / Card — confirmed synchronously
    const slotConfig = await prisma.slotConfig.findUnique({ where: { tenantId: auth.tenantId } });
    const requiredAdvance = calculateRequiredAdvance(
      booking.totalAmount,
      slotConfig?.advancePaymentRequired ?? true,
      slotConfig?.advancePaymentPercent  ?? 100
    );

    const result = applyPayment({
      currentPaidAmount: booking.paidAmount,
      totalAmount:       booking.totalAmount,
      requiredAdvance,
      paymentAmount:     data.amount,
    });

    const [payment, updatedBooking] = await prisma.$transaction([
      prisma.bookingPayment.create({
        data: {
          bookingId: booking.id,
          amount:    data.amount,
          method:    data.method,
          status:    'completed',
        },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paidAmount:      result.newPaidAmount,
          remainingAmount: result.newRemainingAmount,
          // Only escalate status forward — never downgrade a COMPLETED booking
          status: booking.status === 'COMPLETED' ? 'COMPLETED' : result.newStatus,
        },
      }),
    ]);

    return created(
      {
        payment: { id: payment.id, status: payment.status, amount: payment.amount },
        booking: {
          id:              updatedBooking.id,
          status:          updatedBooking.status,
          paidAmount:      updatedBooking.paidAmount,
          remainingAmount: updatedBooking.remainingAmount,
        },
      },
      updatedBooking.status === 'CONFIRMED' && booking.status === 'PENDING_PAYMENT'
        ? 'Payment recorded — booking confirmed'
        : 'Payment recorded'
    );
  } catch (error) {
    return serverError(error);
  }
}
