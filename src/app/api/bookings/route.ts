// src/app/api/bookings/route.ts
// GET  /api/bookings — list bookings (customer sees own; staff/owner see tenant's)
// POST /api/bookings — create a booking
//
// POST flow:
//   1. Validate input
//   2. Load services (must all belong to tenant, be active) → compute totalAmount + endTime
//   3. Re-validate slot via isSlotAvailable() (race-condition guard)
//   4. Compute requiredAdvance from SlotConfig
//   5. Create Booking + BookingService rows in a transaction
//      (status starts PENDING_PAYMENT unless advance payment not required → CONFIRMED)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, created, badRequest, forbidden, conflict, serverError,
  parsePagination, paginationSkip,
} from '@/lib/api-helpers';
import { createBookingSchema, bookingListQuerySchema, validate } from '@/lib/validation';
import { isSlotAvailable } from '@/lib/booking/slotEngine';
import { calculateRequiredAdvance } from '@/lib/booking/bookingMath';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── Time helper ────────────────────────────────────────────────

function addMinutesToTime(startTime: string, minutes: number): string {
  const [h, m] = startTime.split(':').map(Number);
  const total  = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

// ─── GET /api/bookings ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const { searchParams } = request.nextUrl;
    const pagination = parsePagination(searchParams);

    const { data, errors } = validate(bookingListQuerySchema, {
      status:  searchParams.get('status')  ?? undefined,
      staffId: searchParams.get('staffId') ?? undefined,
      from:    searchParams.get('from')    ?? undefined,
      to:      searchParams.get('to')      ?? undefined,
    });
    if (errors) return badRequest('Validation failed', errors);

    const isPrivileged =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('booking.view');

    const where: Prisma.BookingWhereInput = {
      tenantId: auth.tenantId,
      // Customers only ever see their own bookings, regardless of filters
      ...(isPrivileged ? {} : { customerId: auth.userId }),
      ...(data.status && { status: data.status }),
      ...(data.staffId && { staffId: data.staffId }),
      ...(data.from && data.to && { date: { gte: data.from, lte: data.to } }),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip:    paginationSkip(pagination),
        take:    pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
          staff:    { select: { user: { select: { name: true } } } },
          services: { select: { id: true, serviceId: true, price: true, service: { select: { name: true } } } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pagination.limit);

    return ok({
      items: bookings.map(b => ({
        id:           b.id,
        customerName: b.customer.name,
        staffName:    b.staff?.user.name ?? null,
        date:         b.date,
        startTime:    b.startTime,
        endTime:      b.endTime,
        status:       b.status,
        totalAmount:  b.totalAmount,
        paidAmount:   b.paidAmount,
        serviceNames: b.services.map(s => s.service.name),
        createdAt:    b.createdAt,
      })),
      pagination: {
        total, page: pagination.page, limit: pagination.limit,
        totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── POST /api/bookings ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(createBookingSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const { serviceIds, staffId, resourceId, date, startTime, notes } = data;

    // 1. Load and validate services
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId: auth.tenantId, isActive: true },
    });

    if (services.length !== serviceIds.length) {
      return badRequest('One or more services were not found or are inactive');
    }

    const totalAmount = services.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const endTime = addMinutesToTime(startTime, totalDuration);

    // 2. Validate staff belongs to tenant (if provided)
    if (staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId: auth.tenantId, isActive: true },
      });
      if (!staff) return badRequest('Staff member not found or inactive');
    }

    // 3. Validate resource belongs to tenant (if provided)
    if (resourceId) {
      const resource = await prisma.resource.findFirst({
        where: { id: resourceId, tenantId: auth.tenantId, isActive: true },
      });
      if (!resource) return badRequest('Resource not found or inactive');
    }

    // 4. Race-condition guard — re-validate the slot right before insert.
    //    Uses the FIRST service's duration for the grid check; the actual
    //    overlap check below at insert time validates the full span via
    //    the DB unique constraint + explicit overlap query.
    const primaryServiceId = serviceIds[0];
    const slotCheck = await isSlotAvailable({
      tenantId:  auth.tenantId,
      date,
      startTime,
      serviceId: primaryServiceId,
      staffId:   staffId ?? null,
    });

    if (!slotCheck.available) {
      return conflict(slotCheck.reason ?? 'This slot is no longer available');
    }

    // 5. Explicit overlap check across the FULL multi-service duration window
    //    (isSlotAvailable above only checked the primary service's duration grid;
    //    this is the authoritative check for the combined duration).
    const existingOverlap = await prisma.booking.findFirst({
      where: {
        tenantId: auth.tenantId,
        date,
        status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] },
        ...(staffId ? { staffId } : {}),
        ...(resourceId ? { resourceId } : {}),
        AND: [
          { startTime: { lt: endTime } },
          { endTime:   { gt: startTime } },
        ],
      },
    });

    if (existingOverlap) {
      return conflict('This time slot was just booked by someone else. Please choose another.');
    }

    // 6. Load slot config for advance payment rules
    const slotConfig = await prisma.slotConfig.findUnique({
      where: { tenantId: auth.tenantId },
    });

    const advancePaymentRequired = slotConfig?.advancePaymentRequired ?? true;
    const advancePaymentPercent  = slotConfig?.advancePaymentPercent  ?? 100;

    const requiredAdvance = calculateRequiredAdvance(
      totalAmount, advancePaymentRequired, advancePaymentPercent
    );

    // If no advance required (requiredAdvance === totalAmount due to flag off,
    // meaning full payment expected at booking time via in-person/cash flow),
    // OR if total is 0 (free services), confirm immediately with no payment due.
    const initialStatus = totalAmount === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT';

    // 7. Create booking + booking services in a transaction
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          tenantId:        auth.tenantId!,
          customerId:      auth.userId,
          staffId:         staffId ?? null,
          resourceId:      resourceId ?? null,
          date,
          startTime,
          endTime,
          status:          initialStatus,
          totalAmount,
          paidAmount:      0,
          remainingAmount: totalAmount,
          paymentPercent:  advancePaymentPercent,
          notes:           notes ?? null,
        },
      });

      await tx.bookingService.createMany({
        data: services.map(s => ({
          bookingId: created.id,
          serviceId: s.id,
          price:     s.price,
        })),
      });

      return created;
    });

    return created(
      {
        booking: {
          id:               booking.id,
          status:           booking.status,
          date:             booking.date,
          startTime:        booking.startTime,
          endTime:          booking.endTime,
          totalAmount:      booking.totalAmount,
          requiredAdvance,
          paidAmount:       booking.paidAmount,
          remainingAmount:  booking.remainingAmount,
        },
      },
      booking.status === 'CONFIRMED'
        ? 'Booking confirmed'
        : `Booking created — pay ${requiredAdvance} to confirm`
    );
  } catch (error) {
    // Unique constraint race (same staff/date/startTime) — translate to a clean 409
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return conflict('This time slot was just booked. Please choose another.');
    }
    return serverError(error);
  }
}
