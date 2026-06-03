// prisma/seed.ts
// Run with: npm run db:seed
//
// Seeds:
//  1. All permission codes
//  2. System roles (SUPER_ADMIN, VENDOR_OWNER, STAFF, CUSTOMER) with default permissions
//  3. Super Admin user from environment variables
//
// FIX: PostgreSQL treats NULL != NULL in unique constraints.
// Cannot use upsert({ where: { name_tenantId: { tenantId: null } } })
// Solution: findFirst + create/update manually for null-tenantId records.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Permission definitions ───────────────────────────────────────
const PERMISSIONS = [
  // Booking
  { code: 'booking.view',    module: 'booking',   action: 'view',   description: 'View bookings' },
  { code: 'booking.create',  module: 'booking',   action: 'create', description: 'Create bookings' },
  { code: 'booking.edit',    module: 'booking',   action: 'edit',   description: 'Edit bookings' },
  { code: 'booking.delete',  module: 'booking',   action: 'delete', description: 'Cancel/delete bookings' },
  // Inventory
  { code: 'inventory.view',   module: 'inventory', action: 'view',   description: 'View inventory' },
  { code: 'inventory.manage', module: 'inventory', action: 'manage', description: 'Manage stock (in/out/adjust)' },
  // Products
  { code: 'product.view',    module: 'inventory', action: 'view',   description: 'View products' },
  { code: 'product.create',  module: 'inventory', action: 'create', description: 'Create products' },
  { code: 'product.edit',    module: 'inventory', action: 'edit',   description: 'Edit products' },
  { code: 'product.delete',  module: 'inventory', action: 'delete', description: 'Delete products' },
  // Billing
  { code: 'billing.view',    module: 'billing',   action: 'view',   description: 'View bills/invoices' },
  { code: 'billing.create',  module: 'billing',   action: 'create', description: 'Create bills' },
  { code: 'billing.refund',  module: 'billing',   action: 'edit',   description: 'Process refunds' },
  // Sales
  { code: 'sales.view',      module: 'billing',   action: 'view',   description: 'View sales reports' },
  // Orders (ecommerce)
  { code: 'orders.view',     module: 'ecommerce', action: 'view',   description: 'View orders' },
  { code: 'orders.manage',   module: 'ecommerce', action: 'manage', description: 'Update order status' },
  // Customers (CRM)
  { code: 'customer.view',   module: 'crm',       action: 'view',   description: 'View customers' },
  { code: 'customer.edit',   module: 'crm',       action: 'edit',   description: 'Edit customer notes/tags' },
  // Reports
  { code: 'report.view',     module: 'report',    action: 'view',   description: 'View reports and analytics' },
  { code: 'report.export',   module: 'report',    action: 'manage', description: 'Export reports' },
  // Staff
  { code: 'staff.view',      module: 'staff',     action: 'view',   description: 'View staff list' },
  { code: 'staff.manage',    module: 'staff',     action: 'manage', description: 'Create/edit/deactivate staff' },
  // Settings
  { code: 'settings.view',   module: 'settings',  action: 'view',   description: 'View tenant settings' },
  { code: 'settings.manage', module: 'settings',  action: 'manage', description: 'Update tenant settings, modules' },
] as const;

// ─── Default permission sets per role ────────────────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map(p => p.code), // all 24 permissions

  VENDOR_OWNER: [
    'booking.view', 'booking.create', 'booking.edit', 'booking.delete',
    'inventory.view', 'inventory.manage',
    'product.view', 'product.create', 'product.edit', 'product.delete',
    'billing.view', 'billing.create', 'billing.refund',
    'sales.view',
    'orders.view', 'orders.manage',
    'customer.view', 'customer.edit',
    'report.view', 'report.export',
    'staff.view', 'staff.manage',
    'settings.view', 'settings.manage',
  ],

  STAFF: [
    'booking.view', 'booking.create', 'booking.edit',
    'inventory.view',
    'product.view',
    'billing.view', 'billing.create',
    'orders.view',
    'customer.view',
    'report.view',
    'staff.view',
  ],

  CUSTOMER: [
    'booking.view', 'booking.create',
    'orders.view',
    'customer.view',
  ],
};

// ─── Helper: findOrCreate for null-tenantId records ───────────────
// Cannot use prisma.upsert with tenantId: null because PostgreSQL
// treats NULL != NULL in unique constraints (@@unique([name, tenantId])).
// This helper does a safe findFirst → create or update manually.

async function upsertSystemRole(roleName: string) {
  const existing = await prisma.role.findFirst({
    where: { name: roleName, tenantId: null },
  });

  if (existing) {
    // Role already exists — return it as-is (nothing to update for roles)
    return existing;
  }

  return prisma.role.create({
    data: {
      name:        roleName,
      tenantId:    null,
      isSystem:    true,
      description: `System role: ${roleName}`,
    },
  });
}

async function upsertSystemUser(email: string, name: string, passwordHash: string) {
  const existing = await prisma.user.findFirst({
    where: { email, tenantId: null },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data:  { name, passwordHash },
    });
  }

  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      tenantId: null,
      isActive: true,
    },
  });
}

async function upsertUserRoleAssign(userId: string, roleId: string) {
  const existing = await prisma.userRoleAssign.findFirst({
    where: { userId, roleId },
  });

  if (existing) return existing;

  return prisma.userRoleAssign.create({
    data: {
      userId,
      roleId,
      tenantId: 'SYSTEM',
    },
  });
}

// ─── Main seed function ───────────────────────────────────────────
async function main() {
  console.log('🌱 Starting database seed...\n');

  // ── 1. Upsert permission codes ─────────────────────────────────
  console.log('📋 Seeding permissions...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where:  { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  console.log(`   ✅ ${PERMISSIONS.length} permissions seeded\n`);

  // ── 2. Create/sync system roles with permissions ───────────────
  console.log('🎭 Seeding system roles...');

  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    // findFirst + create (safe for null tenantId)
    const role = await upsertSystemRole(roleName);

    // Get permission records for this role's codes
    const permCodes   = ROLE_PERMISSIONS[roleName];
    const permRecords = await prisma.permission.findMany({
      where: { code: { in: permCodes } },
    });

    // Clean sync: remove all existing, then re-add
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data:           permRecords.map(p => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    console.log(`   ✅ ${roleName} — ${permCodes.length} permissions assigned`);
  }

  console.log();

  // ── 3. Seed Super Admin user ───────────────────────────────────
  console.log('👤 Seeding Super Admin user...');

  const email    = process.env.SUPER_ADMIN_EMAIL    ?? 'superadmin@bos.com';
  const password = process.env.SUPER_ADMIN_PASSWORD ?? 'changeme123';
  const name     = process.env.SUPER_ADMIN_NAME     ?? 'Super Admin';

  if (password === 'changeme123') {
    console.warn('   ⚠️  WARNING: Using default password. Set SUPER_ADMIN_PASSWORD in .env!');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // findFirst + create/update (safe for null tenantId)
  const superAdmin = await upsertSystemUser(email, name, passwordHash);

  // Assign SUPER_ADMIN role
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'SUPER_ADMIN', tenantId: null },
  });

  if (superAdminRole) {
    await upsertUserRoleAssign(superAdmin.id, superAdminRole.id);
  }

  console.log(`   ✅ Super Admin created: ${email}`);
  console.log(`   📝 ID: ${superAdmin.id}\n`);

  // ── Summary ────────────────────────────────────────────────────
  const permCount = await prisma.permission.count();
  const roleCount = await prisma.role.count();

  console.log('✅ Seed completed successfully!');
  console.log('─────────────────────────────────────────');
  console.log(`Permissions         : ${permCount}`);
  console.log(`System Roles        : ${roleCount}`);
  console.log(`Super Admin Email   : ${email}`);
  console.log(`Super Admin Password: ${password === 'changeme123' ? '⚠️  changeme123 (CHANGE THIS!)' : '(set in .env)'}`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });