// src/app/api/super-admin/vendors/[id]/approve/route.ts
// PATCH /api/super-admin/vendors/[id]/approve
//
// Approves a pending vendor registration.
// Super Admin only.
//
// Transaction (atomic — all succeed or all roll back):
//   1. Update Tenant: status → APPROVED, isActive → true
//   2. Create VENDOR_OWNER User with hashed password
//   3. Assign VENDOR_OWNER system role to the new user
//   4. Create TenantSettings with sensible defaults
//   5. Update TenantSettings footerMessage (clear registration metadata)
//   6. Create VENDOR_APPROVED in-app notification for the owner

import { NextRequest } from 'next/server';
import { authenticateSuperAdmin, ok, badRequest, notFound, serverError } from '@/lib/api-helpers';
import { createVendorOwnerUser } from '@/lib/auth-db';
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

    // ── Step 2: Fetch the tenant ──────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where:  { id: tenantId },
      select: {
        id:      true,
        name:    true,
        status:  true,
        email:   true,
        settings: {
          select: { id: true, footerMessage: true },
        },
      },
    });

    if (!tenant) return notFound('Vendor');

    if (tenant.status === 'APPROVED') {
      return badRequest('Vendor is already approved');
    }

    if (tenant.status === 'SUSPENDED') {
      return badRequest('Cannot approve a suspended vendor. Unsuspend first.');
    }

    // ── Step 3: Extract owner registration data ───────────────────
    const settingsFooter = tenant.settings?.footerMessage ?? null;
    let ownerData: {
      ownerName:    string;
      ownerEmail:   string;
      ownerPassword: string;
      ownerPhone:   string | null;
    } | null = null;

    if (settingsFooter) {
      try {
        const parsed = JSON.parse(settingsFooter);
        if (parsed.__registration) {
          ownerData = {
            ownerName:     parsed.ownerName,
            ownerEmail:    parsed.ownerEmail,
            ownerPassword: parsed.ownerPassword,
            ownerPhone:    parsed.ownerPhone ?? null,
          };
        }
      } catch {
        // Not JSON metadata
      }
    }

    if (!ownerData) {
      return badRequest(
        'Registration data not found for this vendor. The registration may be malformed.'
      );
    }

    // ── Step 4: Run approval transaction ─────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 4a. Activate the tenant
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data:  { status: 'APPROVED', isActive: true },
        select: {
          id:       true,
          name:     true,
          slug:     true,
          email:    true,
          modules:  true,
          status:   true,
          isActive: true,
        },
      });

      // 4b. Create VENDOR_OWNER user (hashes password inside)
      const ownerUser = await createVendorOwnerUser(tx, {
        name:     ownerData!.ownerName,
        email:    ownerData!.ownerEmail,
        password: ownerData!.ownerPassword,
        phone:    ownerData!.ownerPhone,
        tenantId,
      });

      // 4c. Create TenantSettings with defaults (clear registration metadata)
      if (tenant.settings?.id) {
        await tx.tenantSettings.update({
          where: { id: tenant.settings.id },
          data:  {
            footerMessage:  'Thank you for choosing us!',
            gstNumber:      null,
            taxType:        'SINGLE',
            taxPercent:     18,
            cgst:           9,
            sgst:           9,
            currency:       'INR',
            showStoreName:  true,
            showGST:        true,
            defaultLowStock: 10,
          },
        });
      } else {
        await tx.tenantSettings.create({
          data: {
            tenantId,
            footerMessage:  'Thank you for choosing us!',
            defaultLowStock: 10,
          },
        });
      }

      // 4d. Create VENDOR_APPROVED in-app notification
      await tx.notification.create({
        data: {
          tenantId,
          userId:  ownerUser.id,
          type:    'VENDOR_APPROVED',
          title:   'Your business has been approved! 🎉',
          message: `Welcome to BOS! Your business "${updatedTenant.name}" is now live. Log in to set up your account.`,
          isRead:  false,
        },
      });

      return { tenant: updatedTenant, owner: ownerUser };
    });

    return ok(
      {
        vendor: {
          id:       result.tenant.id,
          name:     result.tenant.name,
          slug:     result.tenant.slug,
          status:   result.tenant.status,
          isActive: result.tenant.isActive,
          modules:  result.tenant.modules,
          owner: {
            id:    result.owner.id,
            name:  result.owner.name,
            email: result.owner.email,
          },
          loginUrl: `http://${result.tenant.slug}.localhost:3000/login`,
        },
      },
      `Vendor "${result.tenant.name}" approved successfully`
    );
  } catch (error) {
    return serverError(error);
  }
}
