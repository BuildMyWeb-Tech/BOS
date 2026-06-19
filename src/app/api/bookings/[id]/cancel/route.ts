// src/app/api/bookings/[id]/cancel/route.ts
// PATCH /api/bookings/[id]/cancel
//
// Customer can cancel their own booking; staff/owner can cancel any.
// Respects SlotConfig.rescheduleHoursBefore as the cancellation window too.
// Cancelling frees the slot implicitly — getAvailableSlots only counts
// PENDING_PAYMENT/CONFIRMED bookings as blocking.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { cancelBookingSchema, validate } from '@/lib/validation';
import { canModifyBooking } from '@/lib/booking/bookingMath';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
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
      auth.permissions.includes('booking.edit');

    if (!isOwnBooking && !isPrivileged) {
      return forbidden('You do not have permission to cancel this booking');
    }

    if (booking.status === 'CANCELLED') {
      return badRequest('Booking is already cancelled');
    }
    if (booking.status === 'COMPLETED') {
      return badRequest('Cannot cancel a completed booking');
    }

    const body = await request.json().catch(() => ({}));
    const { data, errors } = validate(cancelBookingSchema, body ?? {});
    if (errors) return badRequest('Validation failed', errors);

    // Staff/owner can override the cancellation window; customers cannot.
    if (!isPrivileged) {
      const slotConfig = await prisma.slotConfig.findUnique({ where: { tenantId: auth.tenantId } });
      const check = canModifyBooking({
        date:                  booking.date,
        startTime:             booking.startTime,
        now:                   new Date(),
        rescheduleHoursBefore: slotConfig?.rescheduleHoursBefore ?? 24,
        allowRescheduling:     true, // cancellation window check, not the reschedule-enabled flag
        isReschedule:          false,
      });
      if (!check.allowed) return badRequest(check.reason ?? 'Cannot cancel this close to the appointment');
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status:             'CANCELLED',
        cancellationReason: data.reason ?? null,
        cancelledBy:         isOwnBooking ? 'customer' : 'staff',
      },
    });

    return ok(
      {
        booking: {
          id:                 updated.id,
          status:             updated.status,
          cancellationReason: updated.cancellationReason,
          cancelledBy:        updated.cancelledBy,
        },
      },
      'Booking cancelled'
    );
  } catch (error) {
    return serverError(error);
  }
}
