// src/app/api/slot-config/route.ts
// GET /api/slot-config — get current slot configuration (or sensible defaults)
// PUT /api/slot-config — upsert slot configuration
//
// One SlotConfig per tenant. GET returns defaults if not yet configured.
// Permission: settings.view (GET), settings.manage (PUT)

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, serverError,
} from '@/lib/api-helpers';
import { slotConfigSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

// ─── Default values (mirroring Prisma schema defaults) ────────────

const DEFAULTS = {
  slotStartTime:          '09:00',
  slotEndTime:            '17:00',
  slotDuration:           30,
  breakEnabled:           false,
  breakStartTime:         null,
  breakEndTime:           null,
  daysOpen:               ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  maxAdvanceBookingDays:  30,
  minBookingHoursBefore:  2,
  allowRescheduling:      true,
  rescheduleHoursBefore:  24,
  advancePaymentRequired: true,
  advancePaymentPercent:  100,
};

function formatConfig(config: typeof DEFAULTS & { id?: string; tenantId?: string; createdAt?: Date; updatedAt?: Date }) {
  return {
    id:                     config.id                    ?? null,
    tenantId:               config.tenantId              ?? null,
    slotStartTime:          config.slotStartTime,
    slotEndTime:            config.slotEndTime,
    slotDuration:           config.slotDuration,
    breakEnabled:           config.breakEnabled,
    breakStartTime:         config.breakStartTime        ?? null,
    breakEndTime:           config.breakEndTime          ?? null,
    daysOpen:               config.daysOpen,
    maxAdvanceBookingDays:  config.maxAdvanceBookingDays,
    minBookingHoursBefore:  config.minBookingHoursBefore,
    allowRescheduling:      config.allowRescheduling,
    rescheduleHoursBefore:  config.rescheduleHoursBefore,
    advancePaymentRequired: config.advancePaymentRequired,
    advancePaymentPercent:  config.advancePaymentPercent,
    createdAt:              config.createdAt             ?? null,
    updatedAt:              config.updatedAt             ?? null,
    isDefault:              !config.id, // true = using fallback, not yet saved
  };
}

// ─── GET /api/slot-config ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.view') ||
      auth.permissions.includes('booking.view');
    if (!canView) return forbidden('Missing permission: settings.view');

    const config = await prisma.slotConfig.findUnique({
      where: { tenantId: auth.tenantId },
    });

    // Return saved config or defaults
    return ok({
      slotConfig: config
        ? formatConfig(config as typeof DEFAULTS & typeof config)
        : formatConfig({ ...DEFAULTS, tenantId: auth.tenantId }),
    });
  } catch (error) {
    return serverError(error);
  }
}

// ─── PUT /api/slot-config ─────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canManage =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.manage');
    if (!canManage) return forbidden('Missing permission: settings.manage');

    const body = await request.json().catch(() => null);
    if (!body)  return badRequest('Request body is required');

    const { data, errors } = validate(slotConfigSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    // Upsert — create if doesn't exist, update if it does
    const config = await prisma.slotConfig.upsert({
      where:  { tenantId: auth.tenantId },
      create: {
        tenantId:               auth.tenantId,
        slotStartTime:          data.slotStartTime,
        slotEndTime:            data.slotEndTime,
        slotDuration:           data.slotDuration,
        breakEnabled:           data.breakEnabled,
        breakStartTime:         data.breakStartTime ?? null,
        breakEndTime:           data.breakEndTime   ?? null,
        daysOpen:               data.daysOpen,
        maxAdvanceBookingDays:  data.maxAdvanceBookingDays,
        minBookingHoursBefore:  data.minBookingHoursBefore,
        allowRescheduling:      data.allowRescheduling,
        rescheduleHoursBefore:  data.rescheduleHoursBefore,
        advancePaymentRequired: data.advancePaymentRequired,
        advancePaymentPercent:  data.advancePaymentPercent,
      },
      update: {
        slotStartTime:          data.slotStartTime,
        slotEndTime:            data.slotEndTime,
        slotDuration:           data.slotDuration,
        breakEnabled:           data.breakEnabled,
        breakStartTime:         data.breakStartTime ?? null,
        breakEndTime:           data.breakEndTime   ?? null,
        daysOpen:               data.daysOpen,
        maxAdvanceBookingDays:  data.maxAdvanceBookingDays,
        minBookingHoursBefore:  data.minBookingHoursBefore,
        allowRescheduling:      data.allowRescheduling,
        rescheduleHoursBefore:  data.rescheduleHoursBefore,
        advancePaymentRequired: data.advancePaymentRequired,
        advancePaymentPercent:  data.advancePaymentPercent,
      },
    });

    return ok(
      { slotConfig: formatConfig(config as typeof DEFAULTS & typeof config) },
      'Slot configuration saved'
    );
  } catch (error) {
    return serverError(error);
  }
}
