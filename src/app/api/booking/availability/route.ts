// src/app/api/booking/availability/route.ts
// GET /api/booking/availability?serviceId=...&staffId=...&date=YYYY-MM-DD
//
// Returns the available time slots for one day, for booking a given service
// (and optionally a specific staff member).
//
// Permission: booking.view (staff/owner browsing) — customers calling this
// from a public booking widget will go through a separate public endpoint
// in a later phase; for now this requires authentication.

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { availabilityQuerySchema, validate } from '@/lib/validation';
import { getAvailableSlots } from '@/lib/booking/slotEngine';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.role === 'STAFF'        ||
      auth.role === 'CUSTOMER'     ||
      auth.permissions.includes('booking.view');
    if (!canView) return forbidden('Missing permission: booking.view');

    const { searchParams } = request.nextUrl;
    const { data, errors } = validate(availabilityQuerySchema, {
      serviceId: searchParams.get('serviceId'),
      staffId:   searchParams.get('staffId') ?? undefined,
      date:      searchParams.get('date'),
    });
    if (errors) return badRequest('Validation failed', errors);

    const result = await getAvailableSlots({
      tenantId:  auth.tenantId,
      date:      data.date,
      serviceId: data.serviceId,
      staffId:   data.staffId ?? null,
    });

    return ok({ availability: result });
  } catch (error) {
    return serverError(error);
  }
}
