// src/app/api/booking/availability/range/route.ts
// GET /api/booking/availability/range?serviceId=...&staffId=...&from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns a lightweight per-day summary (isOpen + availableCount, NOT the
// full slot list) across a date range — used to render a calendar picker
// that shows "5 slots available" badges without fetching every slot for
// every day.
//
// Capped at 90 days per request (enforced by availabilityRangeQuerySchema).

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { availabilityRangeQuerySchema, validate } from '@/lib/validation';
import { getAvailableSlots } from '@/lib/booking/slotEngine';
import type { RangeSlotAvailability } from '@/types';

function* eachDate(from: string, to: string): Generator<string> {
  const cursor = new Date(from + 'T00:00:00');
  const end    = new Date(to   + 'T00:00:00');
  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm   = String(cursor.getMonth() + 1).padStart(2, '0');
    const dd   = String(cursor.getDate()).padStart(2, '0');
    yield `${yyyy}-${mm}-${dd}`;
    cursor.setDate(cursor.getDate() + 1);
  }
}

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
    const { data, errors } = validate(availabilityRangeQuerySchema, {
      serviceId: searchParams.get('serviceId'),
      staffId:   searchParams.get('staffId') ?? undefined,
      from:      searchParams.get('from'),
      to:        searchParams.get('to'),
    });
    if (errors) return badRequest('Validation failed', errors);

    const dates = [...eachDate(data.from, data.to)];

    // Run all day computations in parallel — each internally batches its own
    // DB calls, so this fans out across the range efficiently.
    const results = await Promise.all(
      dates.map(date =>
        getAvailableSlots({
          tenantId:  auth.tenantId!,
          date,
          serviceId: data.serviceId,
          staffId:   data.staffId ?? null,
        })
      )
    );

    const summary: RangeSlotAvailability[] = results.map(r => ({
      date:           r.date,
      isOpen:         r.isOpen,
      availableCount: r.availableCount,
    }));

    return ok({
      from: data.from,
      to:   data.to,
      days: summary,
    });
  } catch (error) {
    return serverError(error);
  }
}
