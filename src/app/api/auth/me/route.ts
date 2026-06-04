// src/app/api/auth/me/route.ts
// GET /api/auth/me
//
// Returns the current authenticated user's profile.
// Used by the frontend on app load to restore session state.
//
// Headers: Authorization: Bearer <token>
// Response: { user }

import { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api-helpers';
import { ok, serverError } from '@/lib/api-helpers';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // ── Step 1: Authenticate ─────────────────────────────────────
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;

    // ── Step 2: Fetch fresh user data from DB ────────────────────
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        phone:     true,
        image:     true,
        tenantId:  true,
        isActive:  true,
        createdAt: true,
      },
    });

    if (!user) {
      // authenticate() already checks this, but be defensive
      const { unauthorized } = await import('@/lib/api-helpers');
      return unauthorized('Account not found');
    }

    // ── Step 3: Fetch tenant info if applicable ───────────────────
    let tenantInfo = null;
    if (user.tenantId) {
      tenantInfo = await prisma.tenant.findUnique({
        where:  { id: user.tenantId },
        select: { id: true, name: true, slug: true, modules: true },
      });
    }

    return ok({
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        phone:       user.phone,
        image:       user.image,
        role:        auth.role,
        tenantId:    user.tenantId,
        permissions: auth.permissions,
        createdAt:   user.createdAt,
        tenant: tenantInfo
          ? {
              id:      tenantInfo.id,
              name:    tenantInfo.name,
              slug:    tenantInfo.slug,
              modules: (tenantInfo.modules as Record<string, boolean>) ?? {},
            }
          : null,
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
