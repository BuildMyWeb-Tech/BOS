// tests/unit/auth-db.test.ts
// Unit tests for src/lib/auth-db.ts
// Tests the pure logic: role priority ordering, payload shape.
// All Prisma calls are mocked — no real DB needed.

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user:           { findUnique: jest.fn(), findFirst: jest.fn() },
    userRoleAssign: { findMany: jest.fn() },
    tenant:         { findUnique: jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getUserRole, getUserWithPermissions } from '@/lib/auth-db';
import type { UserRole } from '@/lib/auth';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ─── Helpers ─────────────────────────────────────────────────────

function mockRoleAssignments(roleNames: string[]) {
  (mockPrisma.userRoleAssign.findMany as jest.Mock).mockResolvedValue(
    roleNames.map(name => ({
      role: {
        name,
        permissions: [],
      },
    }))
  );
}

// ─── getUserRole — priority ordering ─────────────────────────────

describe('getUserRole', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns SUPER_ADMIN when present', async () => {
    mockRoleAssignments(['SUPER_ADMIN', 'CUSTOMER']);
    expect(await getUserRole('u1')).toBe('SUPER_ADMIN');
  });

  test('returns VENDOR_OWNER over STAFF', async () => {
    mockRoleAssignments(['STAFF', 'VENDOR_OWNER']);
    expect(await getUserRole('u1')).toBe('VENDOR_OWNER');
  });

  test('returns STAFF over CUSTOMER', async () => {
    mockRoleAssignments(['CUSTOMER', 'STAFF']);
    expect(await getUserRole('u1')).toBe('STAFF');
  });

  test('returns CUSTOMER when only customer role', async () => {
    mockRoleAssignments(['CUSTOMER']);
    expect(await getUserRole('u1')).toBe('CUSTOMER');
  });

  test('returns CUSTOMER as fallback when no roles assigned', async () => {
    mockRoleAssignments([]);
    expect(await getUserRole('u1')).toBe('CUSTOMER');
  });

  test('returns SUPER_ADMIN even when listed last', async () => {
    mockRoleAssignments(['CUSTOMER', 'STAFF', 'VENDOR_OWNER', 'SUPER_ADMIN']);
    expect(await getUserRole('u1')).toBe('SUPER_ADMIN');
  });
});

// ─── getUserWithPermissions ───────────────────────────────────────

describe('getUserWithPermissions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns null if user not found', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await getUserWithPermissions('u1')).toBeNull();
  });

  test('returns null if user is inactive', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1', isActive: false,
    });
    expect(await getUserWithPermissions('u1')).toBeNull();
  });

  test('returns role and permissions for active user', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1', isActive: true,
    });

    // Mock getUserRole + getUserPermissions calls (both hit userRoleAssign.findMany)
    (mockPrisma.userRoleAssign.findMany as jest.Mock).mockResolvedValue([
      {
        role: {
          name: 'STAFF',
          permissions: [
            { permission: { code: 'booking.view' } },
            { permission: { code: 'booking.create' } },
          ],
        },
      },
    ]);

    const result = await getUserWithPermissions('u1');
    expect(result).not.toBeNull();
    expect(result?.role).toBe('STAFF');
    expect(result?.permissions).toContain('booking.view');
    expect(result?.permissions).toContain('booking.create');
  });

  test('deduplicates permissions from multiple roles', async () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'u1', isActive: true,
    });

    (mockPrisma.userRoleAssign.findMany as jest.Mock).mockResolvedValue([
      {
        role: {
          name: 'VENDOR_OWNER',
          permissions: [
            { permission: { code: 'booking.view' } },
            { permission: { code: 'booking.create' } },
          ],
        },
      },
      {
        role: {
          name: 'STAFF',
          permissions: [
            { permission: { code: 'booking.view' } }, // duplicate
            { permission: { code: 'product.view' } },
          ],
        },
      },
    ]);

    const result = await getUserWithPermissions('u1');
    const bookingViewCount = result?.permissions.filter(p => p === 'booking.view').length;
    expect(bookingViewCount).toBe(1); // deduplicated
    expect(result?.permissions).toContain('product.view');
  });
});
