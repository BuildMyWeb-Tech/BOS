// src/app/api/auth/login/route.ts
// POST /api/auth/login
//
// Handles login for all 4 roles:
//   SUPER_ADMIN  — email + password, no tenant required
//   VENDOR_OWNER — email + password, tenant resolved from host header
//   STAFF        — email + password, tenant resolved from host header
//   CUSTOMER     — email + password, tenant resolved from host header
//
// Response: { token, refreshToken, user }

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { findUserByEmail, buildJwtPayload, verifyTenantActive } from '@/lib/auth-db';
import { loginSchema, validate } from '@/lib/validation';
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
} from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Parse and validate body ──────────────────────────
    const body = await request.json().catch(() => null);

    if (!body) {
      return badRequest('Request body is required');
    }

    const { data, errors } = validate(loginSchema, body);
    if (errors) {
      return badRequest('Validation failed', errors);
    }

    const { email, password } = data;

    // ── Step 2: Determine context — Super Admin vs Tenant user ───
    // The middleware injects x-tenant-slug if the request comes
    // from a tenant subdomain (acmesalon.localhost:3000).
    // If absent, we treat this as a Super Admin login attempt.
    const tenantSlug = request.headers.get('x-tenant-slug');

    // ── Step 3: Super Admin login path ───────────────────────────
    if (!tenantSlug) {
      const user = await findUserByEmail(email, null); // tenantId = null = super admin

      if (!user) {
        // Generic message — never reveal whether email exists
        return unauthorized('Invalid email or password');
      }

      if (!user.isActive) {
        return forbidden('Account has been deactivated');
      }

      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) {
        return unauthorized('Invalid email or password');
      }

      const jwtPayload = await buildJwtPayload(user);
      if (!jwtPayload) {
        return unauthorized('Account has no role assigned. Contact platform admin.');
      }

      // Super Admin must have SUPER_ADMIN role
      if (jwtPayload.role !== 'SUPER_ADMIN') {
        return forbidden('Access denied');
      }

      const token        = signAccessToken(jwtPayload);
      const refreshToken = signRefreshToken(user.id);

      return ok(
        {
          token,
          refreshToken,
          user: {
            id:          user.id,
            name:        user.name,
            email:       user.email,
            image:       user.image,
            role:        jwtPayload.role,
            tenantId:    null,
            permissions: jwtPayload.permissions,
          },
        },
        'Login successful'
      );
    }

    // ── Step 4: Tenant user login path ───────────────────────────
    // Resolve the tenant from the slug in the header
    const tenant = await prisma.tenant.findUnique({
      where:  { slug: tenantSlug },
      select: { id: true, name: true, slug: true, status: true, isActive: true, modules: true },
    });

    if (!tenant) {
      return badRequest('Tenant not found');
    }

    if (!tenant.isActive || tenant.status !== 'APPROVED') {
      return forbidden(
        tenant.status === 'PENDING'
          ? 'This business is pending approval'
          : 'This business account is not active'
      );
    }

    // Find user within this tenant
    const user = await findUserByEmail(email, tenant.id);

    if (!user) {
      return unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      return forbidden('Account has been deactivated. Contact your administrator.');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return unauthorized('Invalid email or password');
    }

    const jwtPayload = await buildJwtPayload(user);
    if (!jwtPayload) {
      return unauthorized('Account has no role assigned. Contact your administrator.');
    }

    const token        = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(user.id);

    return ok(
      {
        token,
        refreshToken,
        user: {
          id:          user.id,
          name:        user.name,
          email:       user.email,
          image:       user.image,
          role:        jwtPayload.role,
          tenantId:    tenant.id,
          permissions: jwtPayload.permissions,
          tenantName:  tenant.name,
          tenantSlug:  tenant.slug,
          modules:     (tenant.modules as Record<string, boolean>) ?? {},
        },
      },
      'Login successful'
    );
  } catch (error) {
    return serverError(error);
  }
}
