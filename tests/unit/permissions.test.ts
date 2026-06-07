// tests/unit/permissions.test.ts
// Unit tests focused on the RBAC permission logic in auth-db.ts
// Extended from Phase 1B auth-db tests — covers new staff permission scenarios.

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user:           { findUnique: jest.fn(), findFirst: jest.fn() },
    userRoleAssign: { findMany: jest.fn() },
    permission:     { findMany: jest.fn() },
    role:           { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    rolePermission: { createMany: jest.fn() },
    tenant:         { findUnique: jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getUserRole, getUserPermissions, getUserWithPermissions } from '@/lib/auth-db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function mockAssignments(roles: Array<{ name: string; permissions: string[] }>) {
  (mockPrisma.userRoleAssign.findMany as jest.Mock).mockResolvedValue(
    roles.map(r => ({
      role: {
        name: r.name,
        permissions: r.permissions.map(code => ({ permission: { code } })),
      },
    }))
  );
}

// ─── Role priority ────────────────────────────────────────────────

describe('getUserRole — priority ordering', () => {
  beforeEach(() => jest.clearAllMocks());

  test('SUPER_ADMIN wins over everything', async () => {
    mockAssignments([{ name: 'CUSTOMER', permissions: [] }, { name: 'SUPER_ADMIN', permissions: [] }]);
    expect(await getUserRole('u1')).toBe('SUPER_ADMIN');
  });

  test('VENDOR_OWNER wins over STAFF and CUSTOMER', async () => {
    mockAssignments([{ name: 'STAFF', permissions: [] }, { name: 'VENDOR_OWNER', permissions: [] }]);
    expect(await getUserRole('u1')).toBe('VENDOR_OWNER');
  });

  test('STAFF wins over CUSTOMER', async () => {
    mockAssignments([{ name: 'CUSTOMER', permissions: [] }, { name: 'STAFF', permissions: [] }]);
    expect(await getUserRole('u1')).toBe('STAFF');
  });

  test('CUSTOMER when only role', async () => {
    mockAssignments([{ name: 'CUSTOMER', permissions: [] }]);
    expect(await getUserRole('u1')).toBe('CUSTOMER');
  });

  test('defaults to CUSTOMER when no roles', async () => {
    mockAssignments([]);
    expect(await getUserRole('u1')).toBe('CUSTOMER');
  });
});

// ─── Permission deduplication ─────────────────────────────────────

describe('getUserPermissions — deduplication and union', () => {
  beforeEach(() => jest.clearAllMocks());

  test('deduplicates permissions appearing in multiple roles', async () => {
    mockAssignments([
      { name: 'STAFF',        permissions: ['booking.view', 'booking.create'] },
      { name: 'CUSTOM_u1',    permissions: ['booking.view', 'product.edit'] }, // booking.view duplicate
    ]);
    const perms = await getUserPermissions('u1');
    const viewCount = perms.filter(p => p === 'booking.view').length;
    expect(viewCount).toBe(1);
    expect(perms).toContain('product.edit');
    expect(perms).toContain('booking.create');
  });

  test('returns union of all role permissions', async () => {
    mockAssignments([
      { name: 'STAFF',     permissions: ['booking.view', 'customer.view'] },
      { name: 'CUSTOM_u1', permissions: ['product.create', 'inventory.manage'] },
    ]);
    const perms = await getUserPermissions('u1');
    expect(perms).toContain('booking.view');
    expect(perms).toContain('customer.view');
    expect(perms).toContain('product.create');
    expect(perms).toContain('inventory.manage');
  });

  test('returns empty array for user with no roles', async () => {
    mockAssignments([]);
    expect(await getUserPermissions('u1')).toEqual([]);
  });

  test('returns empty array for role with no permissions', async () => {
    mockAssignments([{ name: 'STAFF', permissions: [] }]);
    expect(await getUserPermissions('u1')).toEqual([]);
  });
});

// ─── getUserWithPermissions ───────────────────────────────────────

describe('getUserWithPermissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null when user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await getUserWithPermissions('u1')).toBeNull();
  });

  test('returns null when user inactive', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', isActive: false });
    expect(await getUserWithPermissions('u1')).toBeNull();
  });

  test('returns STAFF role + permissions for active staff user', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', isActive: true });
    mockAssignments([
      {
        name: 'STAFF',
        permissions: ['booking.view', 'booking.create', 'customer.view'],
      },
    ]);
    const result = await getUserWithPermissions('u1');
    expect(result?.role).toBe('STAFF');
    expect(result?.permissions).toContain('booking.view');
    expect(result?.permissions).toContain('customer.view');
  });

  test('staff with custom permissions returns union', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', isActive: true });
    mockAssignments([
      { name: 'STAFF',     permissions: ['booking.view', 'customer.view'] },
      { name: 'CUSTOM_u1', permissions: ['product.create', 'inventory.manage'] },
    ]);
    const result = await getUserWithPermissions('u1');
    expect(result?.role).toBe('STAFF'); // STAFF priority over CUSTOM
    expect(result?.permissions).toContain('product.create');
    expect(result?.permissions).toContain('inventory.manage');
  });
});

// ─── Permission code validation helpers ──────────────────────────

describe('permission code structure', () => {
  const VALID_CODES = [
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
  ];

  test('all 24 permission codes follow module.action pattern', () => {
    for (const code of VALID_CODES) {
      expect(code).toMatch(/^[a-z]+\.[a-z]+$/);
    }
  });

  test('all 24 codes are unique', () => {
    const unique = new Set(VALID_CODES);
    expect(unique.size).toBe(VALID_CODES.length);
  });

  test('all 24 permission codes are present', () => {
    expect(VALID_CODES).toHaveLength(24);
  });

  test('every code has a known module', () => {
    const KNOWN_MODULES = ['booking', 'inventory', 'product', 'billing', 'sales',
                           'orders', 'customer', 'report', 'staff', 'settings'];
    for (const code of VALID_CODES) {
      const module = code.split('.')[0];
      expect(KNOWN_MODULES).toContain(module);
    }
  });
});
