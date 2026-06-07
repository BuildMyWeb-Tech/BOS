// src/lib/auth-db.ts
//
// Database helpers for authentication.
// Separated from auth.ts intentionally:
//   auth.ts    = pure JWT logic (no DB, Edge-runtime safe)
//   auth-db.ts = DB queries used during login / token refresh / vendor approval / staff creation
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

export async function findUserByEmail(
  email: string,
  tenantId: string | null
): Promise<DbUser | null> {
  return prisma.user.findFirst({
    where: { email, tenantId },
    select: {
      id: true, name: true, email: true, phone: true,
      image: true, passwordHash: true, tenantId: true, isActive: true,
    },
  });
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const assignments = await prisma.userRoleAssign.findMany({
    where: { userId },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });
  const codes = assignments.flatMap(a =>
    a.role.permissions.map(rp => rp.permission.code)
  );
  return [...new Set(codes)];
}

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

// ─── Vendor Owner creation (used in approval transaction) ─────────

export async function createVendorOwnerUser(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: { name: string; email: string; password: string; phone?: string | null; tenantId: string }
): Promise<DbUser> {
  const passwordHash = await bcrypt.hash(opts.password, 12);
  const user = await tx.user.create({
    data: {
      name: opts.name, email: opts.email, phone: opts.phone ?? null,
      passwordHash, tenantId: opts.tenantId, isActive: true,
    },
  });
  const vendorOwnerRole = await tx.role.findFirst({
    where: { name: 'VENDOR_OWNER', tenantId: null },
    select: { id: true },
  });
  if (!vendorOwnerRole) throw new Error('VENDOR_OWNER role not found. Run npm run db:seed');
  await tx.userRoleAssign.create({
    data: { userId: user.id, roleId: vendorOwnerRole.id, tenantId: opts.tenantId },
  });
  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    image: user.image, passwordHash: user.passwordHash,
    tenantId: user.tenantId, isActive: user.isActive,
  };
}

// ─── Staff creation (used in POST /api/staff) ─────────────────────

/**
 * Create a staff user + Staff profile + role assignment inside a transaction.
 *
 * Permission strategy:
 *   - Always assign the system STAFF role (11 default permissions)
 *   - If custom permissions[] provided: also create a per-user custom role
 *     named "CUSTOM_[userId]" scoped to the tenant, with only those permissions.
 *     The getUserPermissions() deduplication then returns the union.
 *   - This means default STAFF permissions are always the floor — custom
 *     permissions can add more, never remove system ones. Removal is handled
 *     by updateStaffPermissions() which replaces the custom role entirely.
 */
export async function createStaffUser(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  opts: {
    name:        string;
    email:       string;
    password:    string;
    phone?:      string | null;
    bio?:        string | null;
    tenantId:    string;
    permissions?: string[]; // custom permission codes, optional
  }
): Promise<DbUser> {
  const passwordHash = await bcrypt.hash(opts.password, 12);

  // 1. Create User
  const user = await tx.user.create({
    data: {
      name: opts.name, email: opts.email, phone: opts.phone ?? null,
      passwordHash, tenantId: opts.tenantId, isActive: true,
    },
  });

  // 2. Create Staff profile
  await tx.staff.create({
    data: {
      tenantId:  opts.tenantId,
      userId:    user.id,
      bio:       opts.bio ?? null,
      leaveDates: [],
      isActive:  true,
    },
  });

  // 3. Assign system STAFF role
  const staffRole = await tx.role.findFirst({
    where: { name: 'STAFF', tenantId: null },
    select: { id: true },
  });
  if (!staffRole) throw new Error('STAFF role not found. Run npm run db:seed');

  await tx.userRoleAssign.create({
    data: { userId: user.id, roleId: staffRole.id, tenantId: opts.tenantId },
  });

  // 4. If custom permissions provided, create a per-user custom role
  if (opts.permissions && opts.permissions.length > 0) {
    await applyCustomPermissions(tx, user.id, opts.tenantId, opts.permissions);
  }

  return {
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    image: user.image, passwordHash: user.passwordHash,
    tenantId: user.tenantId, isActive: user.isActive,
  };
}

/**
 * Replace a staff member's custom permissions.
 * Called by PATCH /api/staff/[id]/permissions.
 *
 * Strategy:
 *   - Delete existing custom role for this user (CUSTOM_[userId]) if present
 *   - Create a fresh one with the new permission set
 *   - System STAFF role remains untouched
 */
export async function updateStaffPermissions(
  userId: string,
  tenantId: string,
  permissionCodes: string[]
): Promise<void> {
  // Remove existing custom role + assignment for this user in this tenant
  const existingCustomRole = await prisma.role.findFirst({
    where: { name: `CUSTOM_${userId}`, tenantId },
  });

  if (existingCustomRole) {
    // Delete role (cascades to RolePermission and UserRoleAssign)
    await prisma.role.delete({ where: { id: existingCustomRole.id } });
  }

  if (permissionCodes.length === 0) return;

  // Create fresh custom role with new permissions
  await applyCustomPermissions(
    prisma as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId,
    tenantId,
    permissionCodes
  );
}

/**
 * Internal: create a CUSTOM_[userId] role with given permission codes.
 * Works inside a transaction OR with the raw prisma client.
 */
async function applyCustomPermissions(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId:    string,
  tenantId:  string,
  codes:     string[]
): Promise<void> {
  // Validate all permission codes exist
  const permRecords = await tx.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });

  const foundCodes  = permRecords.map(p => p.code);
  const invalidCodes = codes.filter(c => !foundCodes.includes(c));
  if (invalidCodes.length > 0) {
    throw new Error(`Invalid permission codes: ${invalidCodes.join(', ')}`);
  }

  // Create the custom role
  const customRole = await tx.role.create({
    data: {
      name:        `CUSTOM_${userId}`,
      tenantId,
      isSystem:    false,
      description: `Custom permissions for staff user ${userId}`,
    },
  });

  // Attach permissions
  await tx.rolePermission.createMany({
    data: permRecords.map(p => ({ roleId: customRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // Assign custom role to user
  await tx.userRoleAssign.create({
    data: { userId, roleId: customRole.id, tenantId },
  });
}
