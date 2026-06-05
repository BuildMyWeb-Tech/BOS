// src/app/api/super-admin/vendors/[id]/route.ts
// GET /api/super-admin/vendors/[id]
//
// Fetch full detail of a single vendor/tenant.
// Super Admin only.

import { NextRequest } from 'next/server';
import { authenticateSuperAdmin, ok, notFound, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateSuperAdmin(request);
    if (auth instanceof Response) return auth;

    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
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
            footerMessage:  true, // contains registration metadata pre-approval
            gstNumber:      true,
            taxType:        true,
            taxPercent:     true,
            currency:       true,
            defaultLowStock: true,
          },
        },
        users: {
          where:  { isActive: true },
          select: { id: true, name: true, email: true, createdAt: true },
          take:   5,
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

    if (!tenant) return notFound('Vendor');

    // Extract registration metadata if still pending
    let registrationData = null;
    if (tenant.status === 'PENDING' && tenant.settings?.footerMessage) {
      try {
        const parsed = JSON.parse(tenant.settings.footerMessage);
        if (parsed.__registration) {
          registrationData = {
            ownerName:  parsed.ownerName,
            ownerEmail: parsed.ownerEmail,
            ownerPhone: parsed.ownerPhone,
            // Never expose ownerPassword — even to super admin
          };
        }
      } catch {
        // Not JSON — ignore
      }
    }

    return ok({
      vendor: {
        id:               tenant.id,
        name:             tenant.name,
        slug:             tenant.slug,
        customDomain:     tenant.customDomain,
        businessType:     tenant.businessType,
        description:      tenant.description,
        logo:             tenant.logo,
        email:            tenant.email,
        phone:            tenant.phone,
        address:          tenant.address,
        website:          tenant.website,
        status:           tenant.status,
        isActive:         tenant.isActive,
        modules:          tenant.modules,
        registrationData,
        stats: {
          totalUsers:    tenant._count.users,
          totalBookings: tenant._count.bookings,
          totalProducts: tenant._count.products,
          totalOrders:   tenant._count.orders,
        },
        recentUsers: tenant.users,
        createdAt:   tenant.createdAt,
        updatedAt:   tenant.updatedAt,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
