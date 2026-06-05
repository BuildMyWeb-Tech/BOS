// src/app/api/tenants/me/route.ts
// GET /api/tenants/me
//
// Returns the authenticated vendor owner's tenant profile.
// Requires: VENDOR_OWNER role (or SUPER_ADMIN).
//
// Headers: Authorization: Bearer <token>

import { NextRequest } from 'next/server';
import { authenticate, ok, forbidden, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // ── Step 1: Authenticate ─────────────────────────────────────
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    // ── Step 2: Only VENDOR_OWNER (and SUPER_ADMIN) allowed ──────
    if (auth.role !== 'VENDOR_OWNER' && auth.role !== 'SUPER_ADMIN') {
      return forbidden('Only vendor owners can access this endpoint');
    }

    if (!auth.tenantId) {
      return forbidden('No tenant associated with this account');
    }

    // ── Step 3: Fetch tenant with settings ───────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        id:           true,
        name:         true,
        slug:         true,
        customDomain: true,
        businessType: true,
        description:  true,
        logo:         true,
        email:        true,
        phone:        true,
        address:      true,
        website:      true,
        status:       true,
        isActive:     true,
        modules:      true,
        createdAt:    true,
        updatedAt:    true,
        settings: {
          select: {
            gstNumber:      true,
            taxType:        true,
            taxPercent:     true,
            currency:       true,
            defaultLowStock: true,
          },
        },
        _count: {
          select: {
            users:    true,
            bookings: true,
            products: true,
            orders:   true,
          },
        },
      },
    });

    if (!tenant) {
      return notFound('Tenant');
    }

    return ok({
      tenant: {
        id:           tenant.id,
        name:         tenant.name,
        slug:         tenant.slug,
        customDomain: tenant.customDomain,
        businessType: tenant.businessType,
        description:  tenant.description,
        logo:         tenant.logo,
        email:        tenant.email,
        phone:        tenant.phone,
        address:      tenant.address,
        website:      tenant.website,
        status:       tenant.status,
        isActive:     tenant.isActive,
        modules:      tenant.modules,
        settings:     tenant.settings,
        stats: {
          totalUsers:    tenant._count.users,
          totalBookings: tenant._count.bookings,
          totalProducts: tenant._count.products,
          totalOrders:   tenant._count.orders,
        },
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        // Dev URL hint
        devUrl: `http://${tenant.slug}.localhost:3000`,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
