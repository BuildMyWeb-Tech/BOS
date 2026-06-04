// src/app/api/auth/refresh/route.ts
// POST /api/auth/refresh
//
// Exchange a valid refresh token for a new access + refresh token pair.
// Refresh token rotation: old refresh token is invalidated by issuing a new one.
// (Full rotation with DB blocklist comes in a later security phase.)
//
// Body: { refreshToken: string }
// Response: { token, refreshToken, user }

import { NextRequest } from 'next/server';
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { buildJwtPayload } from '@/lib/auth-db';
import { refreshSchema, validate } from '@/lib/validation';
import { ok, badRequest, unauthorized, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Parse and validate body ──────────────────────────
    const body = await request.json().catch(() => null);

    if (!body) {
      return badRequest('Request body is required');
    }

    const { data, errors } = validate(refreshSchema, body);
    if (errors) {
      return badRequest('Validation failed', errors);
    }

    // ── Step 2: Verify the refresh token ─────────────────────────
    const decoded = verifyRefreshToken(data.refreshToken);

    if (!decoded) {
      return unauthorized('Invalid or expired refresh token');
    }

    // ── Step 3: Re-verify user is still active in DB ─────────────
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id:           true,
        name:         true,
        email:        true,
        phone:        true,
        image:        true,
        passwordHash: true,
        tenantId:     true,
        isActive:     true,
      },
    });

    if (!user) {
      return unauthorized('Account not found');
    }

    if (!user.isActive) {
      return unauthorized('Account has been deactivated');
    }

    // ── Step 4: If user belongs to a tenant, verify tenant still active ──
    if (user.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where:  { id: user.tenantId },
        select: { isActive: true, status: true },
      });

      if (!tenant || !tenant.isActive || tenant.status !== 'APPROVED') {
        return unauthorized('Tenant account is no longer active');
      }
    }

    // ── Step 5: Rebuild JWT payload (picks up any role/permission changes) ──
    const jwtPayload = await buildJwtPayload(user);

    if (!jwtPayload) {
      return unauthorized('Account has no role assigned');
    }

    // ── Step 6: Issue new token pair ──────────────────────────────
    const newToken        = signAccessToken(jwtPayload);
    const newRefreshToken = signRefreshToken(user.id);

    return ok(
      {
        token:        newToken,
        refreshToken: newRefreshToken,
        user: {
          id:          user.id,
          name:        user.name,
          email:       user.email,
          image:       user.image,
          role:        jwtPayload.role,
          tenantId:    user.tenantId,
          permissions: jwtPayload.permissions,
        },
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    return serverError(error);
  }
}
