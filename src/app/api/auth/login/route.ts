// src/app/api/auth/login/route.ts
// POST /api/auth/login
//
// FIX: When no x-tenant-slug header is present (user logging in from the
// main domain / localhost:3000/login), first try Super Admin lookup,
// then fall back to searching ALL tenants for the email.
// This allows vendor owners and staff to log in from the main login page
// without needing to be on their tenant subdomain.

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { findUserByEmail, buildJwtPayload } from '@/lib/auth-db';
import { loginSchema, validate } from '@/lib/validation';
import { ok, badRequest, unauthorized, forbidden, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Parse and validate ────────────────────────────────
    const body = await request.json().catch(() => null);
    if (!body) return badRequest('Request body is required');

    const { data, errors } = validate(loginSchema, body);
    if (errors) return badRequest('Validation failed', errors);

    const { email, password } = data;

    const tenantSlug = request.headers.get('x-tenant-slug');

    // ── Step 2: Tenant subdomain login ────────────────────────────
    // e.g. buildmyweb.localhost:3000 → middleware sets x-tenant-slug=buildmyweb
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({
        where:  { slug: tenantSlug },
        select: { id: true, name: true, slug: true, status: true, isActive: true, modules: true },
      });

      if (!tenant) return badRequest('Tenant not found');

      if (!tenant.isActive || tenant.status !== 'APPROVED') {
        return forbidden(
          tenant.status === 'PENDING'
            ? 'This business is pending approval'
            : 'This business account is not active'
        );
      }

      const user = await findUserByEmail(email, tenant.id);
      if (!user) return unauthorized('Invalid email or password');
      if (!user.isActive) return forbidden('Account deactivated. Contact your administrator.');

      const passwordValid = await bcrypt.compare(password, user.passwordHash);
      if (!passwordValid) return unauthorized('Invalid email or password');

      const jwtPayload = await buildJwtPayload(user);
      if (!jwtPayload) return unauthorized('No role assigned. Contact your administrator.');

      return ok({
        token:        signAccessToken(jwtPayload),
        refreshToken: signRefreshToken(user.id),
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
      }, 'Login successful');
    }

    // ── Step 3: Main domain login (no subdomain) ──────────────────
    // localhost:3000/login or yourdomain.com/login
    // Try in order:
    //   (a) Super Admin — tenantId: null
    //   (b) Any approved tenant user — find by email across all tenants

    // (a) Super Admin attempt
    const superAdminUser = await findUserByEmail(email, null);
    if (superAdminUser && superAdminUser.isActive) {
      const passwordValid = await bcrypt.compare(password, superAdminUser.passwordHash);
      if (passwordValid) {
        const jwtPayload = await buildJwtPayload(superAdminUser);
        if (jwtPayload?.role === 'SUPER_ADMIN') {
          return ok({
            token:        signAccessToken(jwtPayload),
            refreshToken: signRefreshToken(superAdminUser.id),
            user: {
              id:          superAdminUser.id,
              name:        superAdminUser.name,
              email:       superAdminUser.email,
              image:       superAdminUser.image,
              role:        'SUPER_ADMIN',
              tenantId:    null,
              permissions: jwtPayload.permissions,
            },
          }, 'Login successful');
        }
      }
    }

    // (b) Tenant user — search all approved tenants for this email
    // Finds VENDOR_OWNER, STAFF, or CUSTOMER logging in from the main page
    const tenantUser = await prisma.user.findFirst({
      where: {
        email,
        tenantId: { not: null },
        isActive: true,
        tenant: {
          status:   'APPROVED',
          isActive: true,
        },
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, status: true, isActive: true, modules: true },
        },
      },
    });

    if (!tenantUser || !tenantUser.tenant) {
      return unauthorized('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(password, tenantUser.passwordHash);
    if (!passwordValid) return unauthorized('Invalid email or password');

    const jwtPayload = await buildJwtPayload(tenantUser);
    if (!jwtPayload) return unauthorized('No role assigned. Contact your administrator.');

    const tenant = tenantUser.tenant;

    return ok({
      token:        signAccessToken(jwtPayload),
      refreshToken: signRefreshToken(tenantUser.id),
      user: {
        id:          tenantUser.id,
        name:        tenantUser.name,
        email:       tenantUser.email,
        image:       tenantUser.image,
        role:        jwtPayload.role,
        tenantId:    tenant.id,
        permissions: jwtPayload.permissions,
        tenantName:  tenant.name,
        tenantSlug:  tenant.slug,
        modules:     (tenant.modules as Record<string, boolean>) ?? {},
      },
    }, 'Login successful');

  } catch (error) {
    return serverError(error);
  }
}