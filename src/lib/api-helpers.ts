// src/lib/api-helpers.ts
//
// Shared utilities used inside every API route handler.
// Keeps route files clean — one function call to authenticate + authorise.

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, hasPermission, isSuperAdmin, type JwtPayload } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { ApiError, ApiSuccess, PaginationParams } from '@/types';

// ─── Standard JSON response helpers ──────────────────────────────

export function ok<T>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message }),
  } satisfies ApiSuccess<T>);
}

export function created<T>(data: T, message?: string): NextResponse {
  return NextResponse.json(
    { success: true, data, ...(message && { message }) } satisfies ApiSuccess<T>,
    { status: 201 }
  );
}

export function badRequest(error: string, details?: Record<string, string[]>): NextResponse {
  return NextResponse.json(
    { success: false, error, ...(details && { details }) } satisfies ApiError,
    { status: 400 }
  );
}

export function unauthorized(error = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { success: false, error } satisfies ApiError,
    { status: 401 }
  );
}

export function forbidden(error = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { success: false, error } satisfies ApiError,
    { status: 403 }
  );
}

export function notFound(resource = 'Resource'): NextResponse {
  return NextResponse.json(
    { success: false, error: `${resource} not found` } satisfies ApiError,
    { status: 404 }
  );
}

export function serverError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('[BOS API Error]', error);
  return NextResponse.json(
    { success: false, error: message } satisfies ApiError,
    { status: 500 }
  );
}

// ─── Authentication ───────────────────────────────────────────────

/**
 * Authenticate the request.
 * Returns the decoded JWT payload or a 401 NextResponse.
 *
 * Usage:
 *   const auth = await authenticate(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is now JwtPayload
 */
export async function authenticate(
  request: NextRequest
): Promise<JwtPayload | NextResponse> {
  const payload = getTokenFromRequest(request);

  if (!payload) {
    return unauthorized('Missing or invalid token');
  }

  // Re-verify user is still active in DB
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    return unauthorized('Account not found or deactivated');
  }

  return payload;
}

/**
 * Authenticate + check a specific permission code.
 *
 * Usage:
 *   const auth = await authenticateWithPermission(request, 'booking.create');
 *   if (auth instanceof NextResponse) return auth;
 */
export async function authenticateWithPermission(
  request: NextRequest,
  permissionCode: string
): Promise<JwtPayload | NextResponse> {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  // Super admins bypass permission checks
  if (isSuperAdmin(auth)) return auth;

  if (!hasPermission(auth, permissionCode)) {
    return forbidden(`Missing permission: ${permissionCode}`);
  }

  return auth;
}

/**
 * Authenticate + require Super Admin role.
 */
export async function authenticateSuperAdmin(
  request: NextRequest
): Promise<JwtPayload | NextResponse> {
  const auth = await authenticate(request);
  if (auth instanceof NextResponse) return auth;

  if (!isSuperAdmin(auth)) {
    return forbidden('Super Admin access required');
  }

  return auth;
}

// ─── Tenant guard ─────────────────────────────────────────────────

/**
 * Resolve and validate the tenant for an API request.
 * Uses the x-tenant-slug header injected by middleware.
 *
 * Returns { tenantId, modules } or a NextResponse error.
 */
export async function resolveTenant(
  request: NextRequest
): Promise<{ tenantId: string; modules: Record<string, boolean> } | NextResponse> {
  const slug = request.headers.get('x-tenant-slug');

  if (!slug) {
    return badRequest('No tenant context. Check the request host.');
  }

  const tenant = await prisma.tenant.findUnique({
    where:  { slug },
    select: { id: true, isActive: true, status: true, modules: true },
  });

  if (!tenant) return notFound('Tenant');

  if (!tenant.isActive || tenant.status !== 'APPROVED') {
    return forbidden('Tenant is not active');
  }

  return {
    tenantId: tenant.id,
    modules:  (tenant.modules as Record<string, boolean>) ?? {},
  };
}

// ─── Pagination ───────────────────────────────────────────────────

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const search  = searchParams.get('search')  ?? undefined;
  const sortBy  = searchParams.get('sortBy')  ?? undefined;
  const sortDir = (searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

  return { page, limit, search, sortBy, sortDir };
}

export function paginationSkip({ page, limit }: PaginationParams): number {
  return (page - 1) * limit;
}
