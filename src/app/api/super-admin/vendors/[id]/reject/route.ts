// src/app/api/super-admin/vendors/[id]/reject/route.ts
// PATCH /api/super-admin/vendors/[id]/reject
//
// Rejects a pending vendor registration.
// Can also be used to suspend an approved vendor.
// Super Admin only.
//
// Body: { reason: string }

import { NextRequest } from 'next/server';
import { authenticateSuperAdmin, ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import { rejectVendorSchema, validate } from '@/lib/validation';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Step 1: Super Admin only ──────────────────────────────────
    const auth = await authenticateSuperAdmin(request);
    if (auth instanceof Response) return auth;

    const { id: tenantId } = await params;

    // ── Step 2: Validate body ─────────────────────────────────────
    const body = await request.json().catch(() => null);

    if (!body) {
      return badRequest('Request body with rejection reason is required');
    }

    const { data, errors } = validate(rejectVendorSchema, body);
    if (errors) {
      return badRequest('Validation failed', errors);
    }

    // ── Step 3: Fetch tenant ──────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) return notFound('Vendor');

    if (tenant.status === 'REJECTED') {
      return badRequest('Vendor is already rejected');
    }

    // ── Step 4: Reject / Suspend ──────────────────────────────────
    // PENDING → REJECTED (registration declined)
    // APPROVED → SUSPENDED (active vendor suspended)
    const newStatus = tenant.status === 'APPROVED' ? 'SUSPENDED' : 'REJECTED';

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data:  {
        status:   newStatus,
        isActive: false,
      },
      select: {
        id:       true,
        name:     true,
        slug:     true,
        status:   true,
        isActive: true,
        email:    true,
      },
    });

    // ── Step 5: Notify the vendor owner if they exist ─────────────
    const ownerUser = await prisma.user.findFirst({
      where:  { tenantId, isActive: true },
      select: { id: true },
    });

    if (ownerUser) {
      const isRejection  = newStatus === 'REJECTED';
      const isSuspension = newStatus === 'SUSPENDED';

      await prisma.notification.create({
        data: {
          tenantId,
          userId:  ownerUser.id,
          type:    'SYSTEM',
          title:   isRejection
            ? 'Registration not approved'
            : 'Account suspended',
          message: isRejection
            ? `Your business registration was not approved. Reason: ${data.reason}`
            : `Your account has been suspended. Reason: ${data.reason}. Please contact support.`,
          isRead:  false,
        },
      });
    }

    return ok(
      {
        vendor: {
          id:       updatedTenant.id,
          name:     updatedTenant.name,
          slug:     updatedTenant.slug,
          status:   updatedTenant.status,
          isActive: updatedTenant.isActive,
        },
        action: newStatus === 'REJECTED' ? 'rejected' : 'suspended',
        reason: data.reason,
      },
      newStatus === 'REJECTED'
        ? `Vendor "${updatedTenant.name}" rejected`
        : `Vendor "${updatedTenant.name}" suspended`
    );
  } catch (error) {
    return serverError(error);
  }
}
