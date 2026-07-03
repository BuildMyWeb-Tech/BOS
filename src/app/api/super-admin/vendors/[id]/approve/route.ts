// src/app/api/super-admin/vendors/[id]/approve/route.ts
// PATCH /api/super-admin/vendors/[id]/approve
//
// Schema facts confirmed from prisma/schema.prisma:
//   User.passwordHash          ✓ (not password)
//   UserRoleAssign             ✓ (not userRole / userPermission)
//   UserRoleAssign.userId      ✓
//   UserRoleAssign.roleId      ✓
//   UserRoleAssign.tenantId    ✓ (required field)
//   NO UserPermission model    ✓ — permissions live on Role via RolePermission
//   TenantSettings.cgst        ✓ (not cgstPercent)
//   TenantSettings.sgst        ✓ (not sgstPercent)
//   TenantSettings has NO currencySymbol field

import { NextRequest } from 'next/server';
import {
  authenticate, ok, badRequest, forbidden, notFound, serverError,
} from '@/lib/api-helpers';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    if (auth.role !== 'SUPER_ADMIN') return forbidden('Super Admin only');

    const { id: tenantId } = await params;

    // ── 1. Load tenant ────────────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant)                      return notFound('Vendor');
    if (tenant.status === 'APPROVED') return badRequest('Vendor is already approved');

    // ── 2. Pre-compute BEFORE the transaction ─────────────────────
    // Role has @@unique([name, tenantId]) — system roles have tenantId: null
    const ownerRole = await prisma.role.findFirst({
      where: { name: 'VENDOR_OWNER', tenantId: null },
    });
    if (!ownerRole) return serverError(
      new Error('VENDOR_OWNER role not found — run: npm run db:seed')
    );

    // Check if owner user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: tenant.email, tenantId },
    });

    // Hash password outside transaction — bcrypt takes ~300ms and burns TX time
    let tempPassword:   string | null = null;
    let hashedPassword: string | null = null;
    if (!existingUser) {
      tempPassword   = `BOS@${Math.random().toString(36).slice(2, 10)}`;
      hashedPassword = await bcrypt.hash(tempPassword, 10);
      console.info(`[Vendor Approve] Temp password for ${tenant.email}: ${tempPassword}`);
    }

    // ── 3. Transaction with 30s timeout ──────────────────────────
    const result = await prisma.$transaction(async (tx) => {

      // 3a. Approve the tenant
      await tx.tenant.update({
        where: { id: tenantId },
        data:  { status: 'APPROVED', isActive: true },
      });

      // 3b. Create or reactivate the owner user
      let ownerUser = existingUser;
      if (!ownerUser) {
        ownerUser = await tx.user.create({
          data: {
            tenantId,
            name:         tenant.name + ' Owner',
            email:        tenant.email,
            passwordHash: hashedPassword!,   // ✓ matches User.passwordHash
            isActive:     true,
          },
        });
      } else {
        await tx.user.update({
          where: { id: ownerUser.id },
          data:  { isActive: true },
        });
      }

      // 3c. Assign VENDOR_OWNER role via UserRoleAssign
      // Schema: model UserRoleAssign { userId, roleId, tenantId (required) }
      const existingAssign = await tx.userRoleAssign.findFirst({
        where: { userId: ownerUser.id, roleId: ownerRole.id },
      });
      if (!existingAssign) {
        await tx.userRoleAssign.create({
          data: {
            userId:   ownerUser.id,
            roleId:   ownerRole.id,
            tenantId,            // required field on UserRoleAssign
          },
        });
      }

      // 3d. Default slot config (booking module only)
      const modules = tenant.modules as Record<string, boolean>;
      if (modules.booking) {
        const existingSlot = await tx.slotConfig.findUnique({ where: { tenantId } });
        if (!existingSlot) {
          await tx.slotConfig.create({
            data: {
              tenantId,
              slotStartTime:          '09:00',
              slotEndTime:            '18:00',
              slotDuration:           30,
              breakEnabled:           false,
              breakStartTime:         null,
              breakEndTime:           null,
              daysOpen:               ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
              maxAdvanceBookingDays:  30,
              minBookingHoursBefore:  2,
              allowRescheduling:      true,
              rescheduleHoursBefore:  24,
              advancePaymentRequired: true,
              advancePaymentPercent:  100,
            },
          });
        }
      }

      // 3e. Default tenant settings
      // Schema fields: cgst, sgst (not cgstPercent/sgstPercent)
      // No currencySymbol field on TenantSettings
      const existingSettings = await tx.tenantSettings.findUnique({ where: { tenantId } });
      if (!existingSettings) {
        await tx.tenantSettings.create({
          data: {
            tenantId,
            taxType:        'SINGLE',
            taxPercent:     18,
            cgst:           9,      // ✓ matches TenantSettings.cgst
            sgst:           9,      // ✓ matches TenantSettings.sgst
            currency:       'INR',
            defaultLowStock: 10,
          },
        });
      }

      return { ownerUserId: ownerUser.id };

    }, { timeout: 30_000 });

    // ── 4. Notification OUTSIDE transaction (non-critical) ────────
    try {
      await prisma.notification.create({
        data: {
          tenantId,
          userId:  result.ownerUserId,
          type:    'VENDOR_APPROVED',
          title:   'Your business is approved! 🎉',
          message: `Welcome to BOS! "${tenant.name}" has been approved. ` +
                   `Log in at /login with ${tenant.email}.`,
        },
      });
    } catch (e) {
      console.warn('[Vendor Approve] Notification skipped (non-critical):', e);
    }

    return ok(
      { tenantId, status: 'APPROVED', ownerEmail: tenant.email, tempPassword },
      `${tenant.name} approved. Vendor logs in with ${tenant.email}.`
    );

  } catch (error) {
    return serverError(error);
  }
}