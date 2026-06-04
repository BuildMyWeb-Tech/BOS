// src/app/api/auth/register/route.ts
// POST /api/auth/register
//
// Customer self-registration within a tenant.
// Requires tenant context (x-tenant-slug header from middleware).
// Super Admins and Staff are created by admin actions — not self-registration.
//
// On success:
//   1. Creates User record
//   2. Creates Customer CRM record
//   3. Assigns CUSTOMER system role
//   4. Returns token + refreshToken (logged in immediately)

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { buildJwtPayload } from '@/lib/auth-db';
import { registerSchema, validate } from '@/lib/validation';
import {
  created,
  badRequest,
  forbidden,
  serverError,
  conflict,
} from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Validate input ────────────────────────────────────
    const body = await request.json().catch(() => null);

    if (!body) {
      return badRequest('Request body is required');
    }

    const { data, errors } = validate(registerSchema, body);
    if (errors) {
      return badRequest('Validation failed', errors);
    }

    const { name, email, password, phone } = data;

    // ── Step 2: Require tenant context ────────────────────────────
    // Registration always happens within a tenant.
    // Super Admin accounts are seeded — never self-registered.
    const tenantSlug = request.headers.get('x-tenant-slug');

    if (!tenantSlug) {
      return forbidden('Registration requires a tenant context');
    }

    const tenant = await prisma.tenant.findUnique({
      where:  { slug: tenantSlug },
      select: { id: true, name: true, slug: true, status: true, isActive: true, modules: true },
    });

    if (!tenant) {
      return badRequest('Tenant not found');
    }

    if (!tenant.isActive || tenant.status !== 'APPROVED') {
      return forbidden('This business is not accepting registrations');
    }

    // ── Step 3: Check email not already registered in this tenant ─
    const existing = await prisma.user.findFirst({
      where: { email, tenantId: tenant.id },
      select: { id: true },
    });

    if (existing) {
      return conflict('An account with this email already exists');
    }

    // ── Step 4: Get CUSTOMER system role ──────────────────────────
    const customerRole = await prisma.role.findFirst({
      where: { name: 'CUSTOMER', tenantId: null }, // system role
      select: { id: true },
    });

    if (!customerRole) {
      // This should never happen after seeding
      return serverError(new Error('CUSTOMER role not found. Run npm run db:seed'));
    }

    // ── Step 5: Create user + customer + role in one transaction ──
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone:        phone ?? null,
          passwordHash,
          tenantId:     tenant.id,
          isActive:     true,
        },
      });

      // Create the CRM customer profile
      await tx.customer.create({
        data: {
          tenantId: tenant.id,
          userId:   user.id,
          tags:     [],
          notes:    null,
        },
      });

      // Assign CUSTOMER role
      await tx.userRoleAssign.create({
        data: {
          userId:   user.id,
          roleId:   customerRole.id,
          tenantId: tenant.id,
        },
      });

      return user;
    });

    // ── Step 6: Build JWT and return ─────────────────────────────
    const jwtPayload = await buildJwtPayload(newUser);
    if (!jwtPayload) {
      return serverError(new Error('Failed to build JWT after registration'));
    }

    const token        = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(newUser.id);

    return created(
      {
        token,
        refreshToken,
        user: {
          id:          newUser.id,
          name:        newUser.name,
          email:       newUser.email,
          image:       newUser.image,
          role:        jwtPayload.role,
          tenantId:    tenant.id,
          permissions: jwtPayload.permissions,
          tenantName:  tenant.name,
          tenantSlug:  tenant.slug,
        },
      },
      'Registration successful'
    );
  } catch (error) {
    return serverError(error);
  }
}
