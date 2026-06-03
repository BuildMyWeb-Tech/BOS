// src/lib/auth.ts
//
// JWT helpers for BOS.
//
// Token payload structure (JwtPayload):
//   userId    : User.id
//   tenantId  : Tenant.id | null (null = super admin)
//   role      : "SUPER_ADMIN" | "VENDOR_OWNER" | "STAFF" | "CUSTOMER"
//   permissions: string[]  (e.g. ["booking.create", "product.view"])
//   email     : string
//   name      : string

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────

export interface JwtPayload {
  userId:      string;
  tenantId:    string | null;
  role:        UserRole;
  permissions: string[];
  email:       string;
  name:        string;
  iat?:        number;
  exp?:        number;
}

export type UserRole = 'SUPER_ADMIN' | 'VENDOR_OWNER' | 'STAFF' | 'CUSTOMER';

// ─── Constants ────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY  = '7d';
const REFRESH_TOKEN_EXPIRY = '30d';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Check your .env.local file.');
  }
  return secret;
}

// ─── Sign ─────────────────────────────────────────────────────────

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, getSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

// ─── Verify ───────────────────────────────────────────────────────

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as { userId: string; type: string };
    if (decoded.type !== 'refresh') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// ─── Extract from Request ─────────────────────────────────────────

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Expects: "Authorization: Bearer <token>"
 * Returns null if missing, malformed, or expired.
 */
export function getTokenFromRequest(request: NextRequest): JwtPayload | null {
  const authHeader = request.headers.get('authorization') ?? '';

  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return verifyAccessToken(token);
}

// ─── Permission Helpers ───────────────────────────────────────────

/**
 * Check if a JWT payload includes a specific permission code.
 * Example: hasPermission(payload, 'booking.create')
 */
export function hasPermission(
  payload: JwtPayload,
  permissionCode: string
): boolean {
  return payload.permissions.includes(permissionCode);
}

/**
 * Check if a JWT payload includes ALL of the given permission codes.
 */
export function hasAllPermissions(
  payload: JwtPayload,
  permissionCodes: string[]
): boolean {
  return permissionCodes.every(code => payload.permissions.includes(code));
}

/**
 * Check if a JWT payload includes ANY of the given permission codes.
 */
export function hasAnyPermission(
  payload: JwtPayload,
  permissionCodes: string[]
): boolean {
  return permissionCodes.some(code => payload.permissions.includes(code));
}

// ─── Role Helpers ─────────────────────────────────────────────────

export function isSuperAdmin(payload: JwtPayload): boolean {
  return payload.role === 'SUPER_ADMIN';
}

export function isVendorOwner(payload: JwtPayload): boolean {
  return payload.role === 'VENDOR_OWNER';
}

export function isStaff(payload: JwtPayload): boolean {
  return payload.role === 'STAFF';
}

export function isCustomer(payload: JwtPayload): boolean {
  return payload.role === 'CUSTOMER';
}
