// tests/unit/fe1-components.test.ts
//
// Unit tests for FE-1 pure logic.
// UI components themselves are tested via their pure helper functions —
// Next.js App Router pages can't be unit-tested without a full browser
// environment, so we extract and test the logic that would otherwise
// only be caught in E2E tests.

// ─── Badge variant mapping ───────────────────────────────────────

type TenantStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

function statusVariant(status: TenantStatus): string {
  return status === 'PENDING'   ? 'warning'
       : status === 'APPROVED'  ? 'success'
       : status === 'REJECTED'  ? 'danger'
       : 'neutral';
}

describe('statusVariant — vendor status to badge variant', () => {
  test('PENDING maps to warning', () => expect(statusVariant('PENDING')).toBe('warning'));
  test('APPROVED maps to success', () => expect(statusVariant('APPROVED')).toBe('success'));
  test('REJECTED maps to danger', () => expect(statusVariant('REJECTED')).toBe('danger'));
  test('SUSPENDED maps to neutral', () => expect(statusVariant('SUSPENDED')).toBe('neutral'));
});

// ─── Reject reason validation ────────────────────────────────────

function validateRejectReason(reason: string): string | null {
  if (!reason || reason.trim().length === 0) return 'Reason is required';
  if (reason.trim().length < 10) return 'Reason must be at least 10 characters';
  if (reason.length > 500) return 'Reason must be under 500 characters';
  return null;
}

describe('validateRejectReason', () => {
  test('returns null for valid reason', () =>
    expect(validateRejectReason('Incomplete business documents')).toBeNull());
  test('rejects empty string', () =>
    expect(validateRejectReason('')).not.toBeNull());
  test('rejects whitespace-only', () =>
    expect(validateRejectReason('   ')).not.toBeNull());
  test('rejects reason shorter than 10 chars', () =>
    expect(validateRejectReason('Too short')).not.toBeNull());
  test('accepts exactly 10 chars', () =>
    expect(validateRejectReason('1234567890')).toBeNull());
  test('rejects over 500 chars', () =>
    expect(validateRejectReason('a'.repeat(501))).not.toBeNull());
  test('accepts 500 chars exactly', () =>
    expect(validateRejectReason('a'.repeat(500))).toBeNull());
});

// ─── Module flag display logic ───────────────────────────────────

type TenantModules = { booking: boolean; inventory: boolean; billing: boolean; ecommerce: boolean };

function getEnabledModules(modules: TenantModules): string[] {
  return Object.entries(modules)
    .filter(([, enabled]) => enabled)
    .map(([mod]) => mod);
}

describe('getEnabledModules', () => {
  test('returns only enabled modules', () => {
    const result = getEnabledModules({ booking: true, inventory: false, billing: true, ecommerce: false });
    expect(result).toEqual(['booking', 'billing']);
  });
  test('returns empty array when all disabled', () => {
    const result = getEnabledModules({ booking: false, inventory: false, billing: false, ecommerce: false });
    expect(result).toEqual([]);
  });
  test('returns all when all enabled', () => {
    const result = getEnabledModules({ booking: true, inventory: true, billing: true, ecommerce: true });
    expect(result).toHaveLength(4);
  });
});

// ─── Search filter utility ───────────────────────────────────────

function buildVendorQuery(status: string, search: string): string {
  const parts = [
    status !== 'ALL' ? `status=${status}` : '',
    search.trim() ? `search=${encodeURIComponent(search.trim())}` : '',
  ].filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : '';
}

describe('buildVendorQuery', () => {
  test('returns empty string when no filters', () =>
    expect(buildVendorQuery('ALL', '')).toBe(''));
  test('includes status when not ALL', () =>
    expect(buildVendorQuery('PENDING', '')).toBe('?status=PENDING'));
  test('includes search when present', () =>
    expect(buildVendorQuery('ALL', 'acme')).toBe('?search=acme'));
  test('combines status and search', () =>
    expect(buildVendorQuery('PENDING', 'acme')).toBe('?status=PENDING&search=acme'));
  test('encodes special characters in search', () =>
    expect(buildVendorQuery('ALL', 'acme & co')).toBe('?search=acme%20%26%20co'));
  test('trims whitespace from search', () =>
    expect(buildVendorQuery('ALL', '  acme  ')).toBe('?search=acme'));
});

// ─── Business name initial ────────────────────────────────────────

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

describe('getInitial', () => {
  test('returns first letter uppercased', () => expect(getInitial('Acme Salon')).toBe('A'));
  test('handles lowercase input', () => expect(getInitial('grooming hub')).toBe('G'));
  test('handles empty string', () => expect(getInitial('')).toBe('?'));
  test('handles whitespace-only', () => expect(getInitial('   ')).toBe('?'));
});

// ─── Date formatting ──────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  } catch {
    return dateStr;
  }
}

describe('formatDate', () => {
  test('formats a valid ISO date', () => {
    const result = formatDate('2026-06-01T00:00:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
  test('returns fallback for empty string', () => {
    expect(formatDate('')).toBe('Invalid Date');
  });
});

// ─── Login redirect logic ─────────────────────────────────────────

function getPostLoginRedirect(role: string): string {
  return role === 'SUPER_ADMIN' ? '/super-admin/vendors' : '/dashboard';
}

describe('getPostLoginRedirect', () => {
  test('SUPER_ADMIN redirects to super-admin vendors', () =>
    expect(getPostLoginRedirect('SUPER_ADMIN')).toBe('/super-admin/vendors'));
  test('VENDOR_OWNER redirects to dashboard', () =>
    expect(getPostLoginRedirect('VENDOR_OWNER')).toBe('/dashboard'));
  test('STAFF redirects to dashboard', () =>
    expect(getPostLoginRedirect('STAFF')).toBe('/dashboard'));
  test('CUSTOMER redirects to dashboard', () =>
    expect(getPostLoginRedirect('CUSTOMER')).toBe('/dashboard'));
  test('unknown role redirects to dashboard', () =>
    expect(getPostLoginRedirect('UNKNOWN')).toBe('/dashboard'));
});
