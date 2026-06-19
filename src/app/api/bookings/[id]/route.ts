// src/app/api/bookings/[id]/route.ts
// GET /api/bookings/[id] — full booking detail
//
// Customers can only view their own bookings.
// Staff/owner with booking.view can view any booking in their tenant.

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { id } = await params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        customer: { select: { id: true, name: true, email: true } },
        staff:    { select: { id: true, user: { select: { name: true } } } },
        resource: { select: { id: true, name: true } },
        services: { select: { id: true, serviceId: true, price: true, service: { select: { name: true } } } },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!booking) return notFound('Booking');

    const isOwnBooking = booking.customerId === auth.userId;
    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.view');

    if (!isOwnBooking && !isPrivileged) {
      return forbidden('You do not have permission to view this booking');
    }

    return ok({
      booking: {
        id:                 booking.id,
        tenantId:           booking.tenantId,
        customerId:         booking.customerId,
        customerName:       booking.customer.name,
        customerEmail:      booking.customer.email,
        staffId:            booking.staffId,
        staffName:          booking.staff?.user.name ?? null,
        resourceId:         booking.resourceId,
        resourceName:       booking.resource?.name ?? null,
        date:               booking.date,
        startTime:          booking.startTime,
        endTime:            booking.endTime,
        status:             booking.status,
        totalAmount:        booking.totalAmount,
        paidAmount:         booking.paidAmount,
        remainingAmount:    booking.remainingAmount,
        paymentPercent:     booking.paymentPercent,
        notes:              booking.notes,
        cancellationReason: booking.cancellationReason,
        cancelledBy:        booking.cancelledBy,
        services: booking.services.map(s => ({
          id:        s.id,
          serviceId: s.serviceId,
          name:      s.service.name,
          price:     s.price,
        })),
        payments: booking.payments.map(p => ({
          id:                 p.id,
          amount:             p.amount,
          method:             p.method,
          status:             p.status,
          razorpayOrderId:    p.razorpayOrderId,
          razorpayPaymentId:  p.razorpayPaymentId,
          createdAt:          p.createdAt,
        })),
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
