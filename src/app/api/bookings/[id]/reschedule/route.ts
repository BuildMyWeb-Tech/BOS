// src/app/api/bookings/[id]/reschedule/route.ts
// PATCH /api/bookings/[id]/reschedule
//
// Moves a booking to a new date/startTime. Re-validates the new slot
// via isSlotAvailable() and respects allowRescheduling + rescheduleHoursBefore
// against the ORIGINAL appointment time (you can't reschedule something
// that's already too close to happening).

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, conflict, serverError } from '@/lib/api-helpers';
import { rescheduleBookingSchema, validate } from '@/lib/validation';
import { isSlotAvailable } from '@/lib/booking/slotEngine';
import { canModifyBooking } from '@/lib/booking/bookingMath';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

function addMinutesToTime(startTime: string, minutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: { services: { select: { serviceId: true } } },
    });
    if (!booking) return notFound('Booking');

    const isOwnBooking = booking.customerId === auth.userId;
    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.edit');

    if (!isOwnBooking && !isPrivileged) {
      return forbidden('You do not have permission to reschedule this booking');
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return badRequest(`Cannot reschedule a ${booking.status.toLowerCase()} booking`);
    }

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(rescheduleBookingSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const slotConfig = await prisma.slotConfig.findUnique({ where: { tenantId: auth.tenantId } });

    // Reschedule-enabled + window check against the ORIGINAL slot time
    const check = canModifyBooking({
      date:                  booking.date,
      startTime:             booking.startTime,
      now:                   new Date(),
      rescheduleHoursBefore: slotConfig?.rescheduleHoursBefore ?? 24,
      allowRescheduling:     slotConfig?.allowRescheduling ?? true,
      isReschedule:          true,
    });
    if (!check.allowed) return badRequest(check.reason ?? 'This booking can no longer be rescheduled');

    // Compute new endTime from the original total service duration
    const originalDurationMin = timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime);
    const newEndTime = addMinutesToTime(data.startTime, originalDurationMin);

    // Validate the new slot using the booking's primary service
    const primaryServiceId = booking.services[0]?.serviceId;
    if (!primaryServiceId) return badRequest('Booking has no associated service to validate against');

    const slotCheck = await isSlotAvailable({
      tenantId:  auth.tenantId,
      date:      data.date,
      startTime: data.startTime,
      serviceId: primaryServiceId,
      staffId:   booking.staffId,
    });
    if (!slotCheck.available) return conflict(slotCheck.reason ?? 'The new slot is not available');

    // Explicit full-duration overlap check, excluding this booking itself
    const overlap = await prisma.booking.findFirst({
      where: {
        tenantId: auth.tenantId,
        date:     data.date,
        status:   { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        id:       { not: booking.id },
        ...(booking.staffId    ? { staffId: booking.staffId } : {}),
        ...(booking.resourceId ? { resourceId: booking.resourceId } : {}),
        AND: [
          { startTime: { lt: newEndTime } },
          { endTime:   { gt: data.startTime } },
        ],
      },
    });
    if (overlap) return conflict('This time slot was just booked by someone else. Please choose another.');

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        date:      data.date,
        startTime: data.startTime,
        endTime:   newEndTime,
        status:    'RESCHEDULED',
      },
    });

    return ok(
      {
        booking: {
          id:        updated.id,
          date:      updated.date,
          startTime: updated.startTime,
          endTime:   updated.endTime,
          status:    updated.status,
        },
      },
      'Booking rescheduled'
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return conflict('This time slot was just booked. Please choose another.');
    }
    return serverError(error);
  }
}
