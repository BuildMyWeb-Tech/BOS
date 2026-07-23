// src/app/api/storefront/bookings/route.ts
// POST — create guest booking (no auth)
// GET  — fetch bookings by phone number
//
// FIX: BookingService.create requires `price` field — added service.price

import { NextRequest } from 'next/server';
import { ok, created, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const guestBookingSchema = z.object({
  serviceId:     z.string().min(1),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/),
  staffId:       z.string().optional().nullable(),
  customerName:  z.string().min(2),
  customerPhone: z.string().min(7),
  customerEmail: z.string().email().optional().nullable(),
  notes:         z.string().optional().nullable(),
});

// ── POST ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const slug = request.headers.get('x-tenant-slug') ?? request.nextUrl.searchParams.get('slug');
    if (!slug) return badRequest('X-Tenant-Slug header is required');

    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true, name: true },
    });
    if (!tenant) return notFound('Tenant');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body required');

    const parsed = guestBookingSchema.safeParse(body);
    if (!parsed.success) return badRequest('Validation failed', parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const data = parsed.data;

    // Load service — need price for BookingService row
    const service = await prisma.service.findFirst({
      where: { id: data.serviceId, tenantId: tenant.id, isActive: true },
    });
    if (!service) return notFound('Service');

    // Validate staff if provided
    if (data.staffId) {
      const staff = await prisma.staff.findFirst({
        where: { id: data.staffId, tenantId: tenant.id, isActive: true },
      });
      if (!staff) return badRequest('Staff member not found or inactive');
    }

    // Calculate end time
    const [h, m]    = data.startTime.split(':').map(Number);
    const endMins   = h * 60 + m + service.duration;
    const endTime   = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

    // Find or create guest user for this phone
    let guestUser = await prisma.user.findFirst({
      where: { phone: data.customerPhone, tenantId: tenant.id },
    });
    if (!guestUser) {
      guestUser = await prisma.user.create({
        data: {
          tenantId:     tenant.id,
          name:         data.customerName,
          email:        data.customerEmail ?? `guest_${data.customerPhone.replace(/\D/g, '')}@guest.bos`,
          phone:        data.customerPhone,
          passwordHash: 'GUEST_NO_LOGIN',
          isActive:     true,
        },
      });
    }

    // FIX: BookingService requires `price` — pass service.price
    const booking = await prisma.booking.create({
      data: {
        tenantId:        tenant.id,
        customerId:      guestUser.id,
        staffId:         data.staffId ?? null,
        date:            data.date,
        startTime:       data.startTime,
        endTime,
        totalAmount:     service.price,
        paidAmount:      0,
        remainingAmount: service.price,
        status:          'PENDING_PAYMENT',
        notes:           data.notes ?? null,
        services: {
          create: {
            serviceId: service.id,
            price:     service.price,   // ← FIX: was missing
          },
        },
      },
      include: {
        services: {
          include: {
            service: { select: { name: true, duration: true, price: true } },
          },
        },
      },
    });

    return created({
      booking: {
        id:            booking.id,
        date:          booking.date,
        startTime:     booking.startTime,
        endTime:       booking.endTime,
        status:        booking.status,
        totalAmount:   booking.totalAmount,
        serviceName:   service.name,
        customerName:  data.customerName,
        customerPhone: data.customerPhone,
        tenantName:    tenant.name,
      },
    }, 'Booking created successfully');
  } catch (error) {
    return serverError(error);
  }
}

// ── GET — bookings by phone ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const slug  = request.headers.get('x-tenant-slug') ?? searchParams.get('slug');
    const phone = searchParams.get('phone');

    if (!slug)  return badRequest('slug is required');
    if (!phone) return badRequest('phone is required');

    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true },
    });
    if (!tenant) return notFound('Tenant');

    const user = await prisma.user.findFirst({
      where:  { phone, tenantId: tenant.id },
      select: { id: true },
    });
    if (!user) return ok({ bookings: [] });

    const bookings = await prisma.booking.findMany({
      where:   { tenantId: tenant.id, customerId: user.id },
      orderBy: { date: 'desc' },
      include: {
        services: { include: { service: { select: { name: true, price: true } } } },
        staff:    { include: { user: { select: { name: true } } } },
      },
    });

    return ok({
      bookings: bookings.map(b => ({
        id:          b.id,
        date:        b.date,
        startTime:   b.startTime,
        endTime:     b.endTime,
        status:      b.status,
        totalAmount: b.totalAmount,
        paidAmount:  b.paidAmount,
        staffName:   b.staff?.user?.name ?? null,
        services:    b.services.map(s => ({ name: s.service.name, price: s.service.price })),
        notes:       b.notes,
        createdAt:   b.createdAt,
      })),
    });
  } catch (error) {
    return serverError(error);
  }
}
