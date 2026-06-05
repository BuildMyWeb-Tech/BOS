// src/lib/auth-db.ts
//
// Database helpers for authentication.
// Separated from auth.ts intentionally:
//   auth.ts    = pure JWT logic (no DB, Edge-runtime safe)
//   auth-db.ts = DB queries used during login / token refresh / vendor approval
//
// These functions are called ONLY from API route handlers (Node.js runtime).

import prisma from '@/lib/prisma';
import type { UserRole, JwtPayload } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// ─── Types ────────────────────────────────────────────────────────

export interface DbUser {
  id:           string;
  name:         string;
  email:        string;
  phone:        string | null;
  image:        string;
  passwordHash: string;
  tenantId:     string | null;
  isActive:     boolean;
}

export interface UserWithRole extends DbUser {
  role:        UserRole;
  permissions: string[];
}

// ─── Core DB helpers ──────────────────────────────────────────────

/**
 * Find a user by email within a specific tenant.
 * tenantId = null → looks for super admin (platform-level user).
 *
 * Uses findFirst (not findUnique) because @@unique([email, tenantId])
 * cannot be used with null in Prisma's where clause.
 */
export async function findUserByEmail(
  email: string,
  tenantId: string | null
): Promise<DbUser | null> {
  return prisma.user.findFirst({
    where: { email, tenantId },
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
}

/**
 * Get all permission codes for a user via their role assignments.
 * Returns a flat deduplicated array of permission code strings.
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const assignments = await prisma.userRoleAssign.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const codes = assignments.flatMap(a =>
    a.role.permissions.map(rp => rp.permission.code)
  );

  return [...new Set(codes)];
}

/**
 * Get the primary role name for a user.
 * Priority: SUPER_ADMIN > VENDOR_OWNER > STAFF > CUSTOMER
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const assignments = await prisma.userRoleAssign.findMany({
    where: { userId },
    include: { role: true },
  });

  const roleNames = assignments.map(a => a.role.name);
  const PRIORITY: UserRole[] = ['SUPER_ADMIN', 'VENDOR_OWNER', 'STAFF', 'CUSTOMER'];

  for (const role of PRIORITY) {
    if (roleNames.includes(role)) return role;
  }

  return 'CUSTOMER';
}

/**
 * Fetch user + role + permissions in one operation.
 */
export async function getUserWithPermissions(
  userId: string
): Promise<{ role: UserRole; permissions: string[] } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  const [role, permissions] = await Promise.all([
    getUserRole(userId),
    getUserPermissions(userId),
  ]);

  return { role, permissions };
}

/**
 * Build the full JWT payload for a user.
 * Called after successful login or token refresh.
 */
export async function buildJwtPayload(
  user: DbUser
): Promise<Omit<JwtPayload, 'iat' | 'exp'> | null> {
  const roleAndPerms = await getUserWithPermissions(user.id);
  if (!roleAndPerms) return null;

  return {
    userId:      user.id,
    tenantId:    user.tenantId,
    role:        roleAndPerms.role,
    permissions: roleAndPerms.permissions,
    email:       user.email,
    name:        user.name,
  };
}

/**
 * Verify tenant is approved and active.
 */
export async function verifyTenantActive(
  tenantId: string
): Promise<{ id: string; name: string; slug: string; modules: Record<string, boolean> } | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, status: true, isActive: true, modules: true },
  });

  if (!tenant || !tenant.isActive || tenant.status !== 'APPROVED') return null;

  return {
    id:      tenant.id,
    name:    tenant.name,
    slug:    tenant.slug,
    modules: (tenant.modules as Record<string, boolean>) ?? {},
  };
}

/**
 * Create a VENDOR_OWNER user for an approved tenant.
 * Called inside the approval transaction in PATCH /super-admin/vendors/[id]/approve.
 *
 * Steps (run inside caller's transaction):
 *   1. Hash password
 *   2. Create User record
 *   3. Assign VENDOR_OWNER system role
 *
 * Returns the created user (DbUser shape).
 */
export async function createVendorOwnerUser(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    name:        string;
    email:       string;
    password:    string;
    phone?:      string | null;
    tenantId:    string;
  }
): Promise<DbUser> {
  const passwordHash = await bcrypt.hash(opts.password, 12);

  const user = await tx.user.create({
    data: {
      name:         opts.name,
      email:        opts.email,
      phone:        opts.phone ?? null,
      passwordHash,
      tenantId:     opts.tenantId,
      isActive:     true,
    },
  });

  // Get the VENDOR_OWNER system role
  const vendorOwnerRole = await tx.role.findFirst({
    where: { name: 'VENDOR_OWNER', tenantId: null },
    select: { id: true },
  });

  if (!vendorOwnerRole) {
    throw new Error('VENDOR_OWNER role not found. Run npm run db:seed');
  }

  await tx.userRoleAssign.create({
    data: {
      userId:   user.id,
      roleId:   vendorOwnerRole.id,
      tenantId: opts.tenantId,
    },
  });

  return {
    id:           user.id,
    name:         user.name,
    email:        user.email,
    phone:        user.phone,
    image:        user.image,
    passwordHash: user.passwordHash,
    tenantId:     user.tenantId,
    isActive:     user.isActive,
  };
}
