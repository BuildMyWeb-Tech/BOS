// src/app/api/tenant-settings/route.ts
// GET /api/tenant-settings — current tax/currency/GST configuration
// PUT /api/tenant-settings — update configuration (upsert)
//
// Permission: settings.view (GET), settings.manage (PUT)

import { NextRequest } from 'next/server';
import { authenticate, ok, badRequest, forbidden, serverError } from '@/lib/api-helpers';
import { updateTenantSettingsSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

const DEFAULTS = {
  gstNumber:       null as string | null,
  taxType:         'SINGLE' as const,
  taxPercent:      18,
  cgst:            9,
  sgst:            9,
  currency:        'INR',
  showStoreName:   true,
  showGST:         true,
  footerMessage:   'Thank you!',
  defaultLowStock: 10,
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (!auth.tenantId) return forbidden('No tenant context');

    const canView =
      auth.role === 'VENDOR_OWNER' ||
      auth.role === 'SUPER_ADMIN'  ||
      auth.permissions.includes('settings.view');
    if (!canView) return forbidden('Missing permission: settings.view');

    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: auth.tenantId } });

    return ok({
      settings: settings
        ? {
            id:              settings.id,
            tenantId:        settings.tenantId,
            gstNumber:       settings.gstNumber,
            taxType:         settings.taxType,
            taxPercent:      settings.taxPercent,
            cgst:            settings.cgst,
            sgst:            settings.sgst,
            currency:        settings.currency,
            showStoreName:   settings.showStoreName,
            showGST:         settings.showGST,
            footerMessage:   settings.footerMessage,
            defaultLowStock: settings.defaultLowStock,
            createdAt:       settings.createdAt,
            updatedAt:       settings.updatedAt,
            isDefault:       false,
          }
        : { tenantId: auth.tenantId, ...DEFAULTS, isDefault: true },
    });
  } catch (error) {
    return serverError(error);
  }
}

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

    const { data, errors } = validate(updateTenantSettingsSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const updated = await prisma.tenantSettings.upsert({
      where:  { tenantId: auth.tenantId },
      create: {
        tenantId:        auth.tenantId,
        gstNumber:       data.gstNumber       ?? DEFAULTS.gstNumber,
        taxType:         data.taxType         ?? DEFAULTS.taxType,
        taxPercent:      data.taxPercent      ?? DEFAULTS.taxPercent,
        cgst:            data.cgst            ?? DEFAULTS.cgst,
        sgst:            data.sgst            ?? DEFAULTS.sgst,
        currency:        data.currency        ?? DEFAULTS.currency,
        showStoreName:   data.showStoreName   ?? DEFAULTS.showStoreName,
        showGST:         data.showGST         ?? DEFAULTS.showGST,
        footerMessage:   data.footerMessage   ?? DEFAULTS.footerMessage,
        defaultLowStock: data.defaultLowStock ?? DEFAULTS.defaultLowStock,
      },
      update: {
        ...(data.gstNumber       !== undefined && { gstNumber:       data.gstNumber }),
        ...(data.taxType         !== undefined && { taxType:         data.taxType }),
        ...(data.taxPercent      !== undefined && { taxPercent:      data.taxPercent }),
        ...(data.cgst            !== undefined && { cgst:            data.cgst }),
        ...(data.sgst            !== undefined && { sgst:            data.sgst }),
        ...(data.currency        !== undefined && { currency:        data.currency }),
        ...(data.showStoreName   !== undefined && { showStoreName:   data.showStoreName }),
        ...(data.showGST         !== undefined && { showGST:         data.showGST }),
        ...(data.footerMessage   !== undefined && { footerMessage:   data.footerMessage }),
        ...(data.defaultLowStock !== undefined && { defaultLowStock: data.defaultLowStock }),
      },
    });

    return ok(
      {
        settings: {
          id:              updated.id,
          tenantId:        updated.tenantId,
          gstNumber:       updated.gstNumber,
          taxType:         updated.taxType,
          taxPercent:      updated.taxPercent,
          cgst:            updated.cgst,
          sgst:            updated.sgst,
          currency:        updated.currency,
          showStoreName:   updated.showStoreName,
          showGST:         updated.showGST,
          footerMessage:   updated.footerMessage,
          defaultLowStock: updated.defaultLowStock,
          updatedAt:       updated.updatedAt,
        },
      },
      'Settings updated'
    );
  } catch (error) {
    return serverError(error);
  }
}
