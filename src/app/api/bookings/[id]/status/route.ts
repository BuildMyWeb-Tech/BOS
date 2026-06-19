// src/app/api/bookings/[id]/status/route.ts
// PATCH /api/bookings/[id]/status
//
// Manual status transition by staff/owner — e.g. marking a CONFIRMED
// booking as COMPLETED after the appointment happens. This is distinct
// from cancel/reschedule which have their own dedicated, more controlled
// endpoints; this one is for the staff-facing "mark as done" workflow.
//
// Permission: booking.edit. Customers cannot call this endpoint.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, notFound, serverError } from '@/lib/api-helpers';
import { updateBookingStatusSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';
import type { BookingStatus } from '@/types';

type Params = { params: Promise<{ id: string }> };

// Allowed manual transitions — prevents nonsensical jumps like
// PENDING_PAYMENT -> COMPLETED, or resurrecting a CANCELLED booking.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:       ['COMPLETED', 'CANCELLED'],
  COMPLETED:       [],
  CANCELLED:       [],
  RESCHEDULED:     ['CONFIRMED', 'CANCELLED'],
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.edit');
    if (!canManage) return forbidden('Missing permission: booking.edit');

    const { id } = await params;
    const booking = await prisma.booking.findFirst({ where: { id, tenantId: auth.tenantId } });
    if (!booking) return notFound('Booking');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(updateBookingStatusSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const currentStatus = booking.status as BookingStatus;
    const allowed = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowed.includes(data.status)) {
      return badRequest(
        `Cannot transition from ${currentStatus} to ${data.status}. Allowed: ${allowed.join(', ') || 'none'}`
      );
    }

    const updated = await prisma.booking.update({
      where: { id },
      data:  { status: data.status },
    });

    return ok(
      { booking: { id: updated.id, status: updated.status } },
      `Booking status updated to ${updated.status}`
    );
  } catch (error) {
    return serverError(error);
  }
}
