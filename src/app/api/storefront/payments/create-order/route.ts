'use client';
// src/app/api/storefront/payments/create-order/route.ts
// POST — create a Razorpay order for a booking payment
// PUBLIC — no JWT needed (guest bookings use phone as identity)
//
// Uses Razorpay TEST mode (sandbox) — use these test cards:
//   Card: 4111 1111 1111 1111 | Expiry: any future | CVV: any
//   UPI:  success@razorpay
//   Net Banking: any bank → test credentials

import { NextRequest } from 'next/server';
import { ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import Razorpay from 'razorpay';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body required');

    const { bookingId, slug } = body;
    if (!bookingId) return badRequest('bookingId is required');
    if (!slug)      return badRequest('slug is required');

    // Resolve tenant
    const tenant = await prisma.tenant.findFirst({
      where:  { slug: { equals: slug, mode: 'insensitive' }, status: 'APPROVED' },
      select: { id: true, name: true },
    });
    if (!tenant) return notFound('Tenant');

    // Load booking
    const booking = await prisma.booking.findFirst({
      where:   { id: bookingId, tenantId: tenant.id },
      include: { services: { include: { service: { select: { name: true } } } } },
    });
    if (!booking) return notFound('Booking');

    const remaining = booking.totalAmount - booking.paidAmount;
    if (remaining <= 0) return badRequest('Booking is already fully paid');

    // Amount in paise (Razorpay expects paise)
    const amountPaise = Math.round(remaining * 100);

    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID     ?? '',
      key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
    });

    const serviceName = booking.services[0]?.service.name ?? 'Appointment';

    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `booking_${bookingId.slice(-8)}`,
      notes: {
        bookingId,
        tenantId:    tenant.id,
        tenantName:  tenant.name,
        serviceName,
      },
    });

    return ok({
      orderId:   order.id,
      amount:    amountPaise,
      currency:  'INR',
      keyId:     process.env.RAZORPAY_KEY_ID ?? '',
      bookingId,
      tenantName: tenant.name,
      serviceName,
      remaining,
    });
  } catch (error) {
    return serverError(error);
  }
}
