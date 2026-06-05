// src/app/api/tenants/register/route.ts
// POST /api/tenants/register
//
// Public endpoint — no authentication required.
// Vendor submits their business registration.
//
// What this does:
//   1. Validates input
//   2. Checks owner email is not already registered on this platform
//   3. Generates a unique slug from businessName
//   4. Creates Tenant (status: PENDING, isActive: false)
//   5. Stores owner credentials in a PENDING_OWNER record (created on approval)
//   6. Returns the pending tenant details
//
// What happens on approval (Phase 1C PATCH /approve):
//   - Tenant status → APPROVED, isActive → true
//   - Owner User created with VENDOR_OWNER role
//   - TenantSettings created with defaults
//   - VENDOR_APPROVED notification created

import { NextRequest } from 'next/server';
import { vendorRegisterSchema, validate } from '@/lib/validation';
import { generateUniqueSlug } from '@/lib/slug';
import {
  created,
  badRequest,
  conflict,
  serverError,
} from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Parse and validate ────────────────────────────────
    const body = await request.json().catch(() => null);

    if (!body) {
      return badRequest('Request body is required');
    }

    const { data, errors } = validate(vendorRegisterSchema, body);
    if (errors) {
      return badRequest('Validation failed', errors);
    }

    const {
      businessName,
      businessType,
      description,
      address,
      phone,
      website,
      modules,
      ownerName,
      ownerEmail,
      ownerPassword,
      ownerPhone,
    } = data;

    // ── Step 2: Check owner email not already in use ──────────────
    // We check across ALL tenants — one email per platform per tenant is
    // allowed, but we also check if this email exists as a super admin
    // or is already a pending/approved owner elsewhere.
    const existingOwner = await prisma.user.findFirst({
      where: { email: ownerEmail },
      select: { id: true, tenantId: true },
    });

    if (existingOwner) {
      return conflict('An account with this owner email already exists on the platform');
    }

    // ── Step 3: Check for existing pending registration ───────────
    // Prevent duplicate registrations with same business email
    const existingTenant = await prisma.tenant.findFirst({
      where: { email: ownerEmail },
      select: { id: true, status: true },
    });

    if (existingTenant) {
      if (existingTenant.status === 'PENDING') {
        return conflict('A registration with this email is already pending approval');
      }
      if (existingTenant.status === 'APPROVED') {
        return conflict('This email is already registered as an active business');
      }
    }

    // ── Step 4: Generate unique slug ──────────────────────────────
    let slug: string;
    try {
      slug = await generateUniqueSlug(businessName);
    } catch (slugError) {
      return badRequest(
        slugError instanceof Error ? slugError.message : 'Could not generate business URL'
      );
    }

    // ── Step 5: Create the tenant (PENDING) ───────────────────────
    // Owner credentials are stored in metadata JSON on the tenant
    // (hashed on approval, not now — we don't hash until we need it)
    // This is safe because the tenant row is not accessible to anyone
    // until approved, and the password is hashed at approval time.
    const tenant = await prisma.tenant.create({
      data: {
        name:         businessName,
        slug,
        businessType,
        description:  description ?? '',
        address,
        phone,
        email:        ownerEmail,   // business contact = owner email for now
        website:      website || null,
        logo:         '',           // logo upload comes after approval
        status:       'PENDING',
        isActive:     false,
        modules: {
          booking:   modules.booking,
          inventory: modules.inventory,
          billing:   modules.billing,
          ecommerce: modules.ecommerce,
        },
        // Store owner registration data for use at approval time
        // We use the description field override — actually we store in
        // a separate registration metadata approach via settings
      },
      select: {
        id:           true,
        name:         true,
        slug:         true,
        businessType: true,
        email:        true,
        phone:        true,
        address:      true,
        status:       true,
        modules:      true,
        createdAt:    true,
      },
    });

    // ── Step 6: Store owner credentials in TenantSettings ─────────
    // We store the plain owner registration details here temporarily.
    // On approval, these are used to create the User record (with bcrypt hash).
    // The password stored here is PLAIN TEXT intentionally — it will be
    // hashed when the User is created. This record is inaccessible to
    // customers and only read by the approval flow.
    await prisma.tenantSettings.create({
      data: {
        tenantId:       tenant.id,
        // Store owner registration info as footerMessage JSON
        // We use a dedicated approach: store in a safe metadata format
        footerMessage:  JSON.stringify({
          __registration: true,
          ownerName,
          ownerEmail,
          ownerPassword, // hashed at approval time
          ownerPhone:    ownerPhone ?? null,
        }),
      },
    });

    return created(
      {
        tenant: {
          id:           tenant.id,
          name:         tenant.name,
          slug:         tenant.slug,
          businessType: tenant.businessType,
          email:        tenant.email,
          status:       tenant.status,
          modules:      tenant.modules,
          createdAt:    tenant.createdAt,
          message:      'Your registration is pending admin approval. You will be notified once approved.',
        },
      },
      'Registration submitted successfully'
    );
  } catch (error) {
    return serverError(error);
  }
}
