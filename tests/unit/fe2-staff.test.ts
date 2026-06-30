// tests/unit/fe2-staff.test.ts
// Unit tests for FE-2 staff management pure logic.

// ─── Staff form validation ───────────────────────────────────────

interface StaffFormErrors { name?: string; email?: string; password?: string; phone?: string; bio?: string }

function validateStaffForm(data: {
  name: string; email: string; password: string; phone?: string; bio?: string;
}): StaffFormErrors {
  const errors: StaffFormErrors = {};
  if (!data.name.trim() || data.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!data.email.trim())                               errors.email = 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))  errors.email = 'Invalid email address';
  if (data.password.length < 8)                         errors.password = 'Password must be at least 8 characters';
  if (data.phone && !/^[0-9+\-\s()]{7,20}$/.test(data.phone)) errors.phone = 'Invalid phone number';
  if (data.bio && data.bio.length > 300)                errors.bio = 'Bio must be under 300 characters';
  return errors;
}

describe('validateStaffForm', () => {
  const valid = { name: 'Arun Raj', email: 'arun@salon.com', password: 'Salon@123' };

  test('passes valid input', () => expect(Object.keys(validateStaffForm(valid))).toHaveLength(0));
  test('rejects empty name', () => expect(validateStaffForm({ ...valid, name: '' })).toHaveProperty('name'));
  test('rejects single-char name', () => expect(validateStaffForm({ ...valid, name: 'A' })).toHaveProperty('name'));
  test('rejects empty email', () => expect(validateStaffForm({ ...valid, email: '' })).toHaveProperty('email'));
  test('rejects invalid email format', () => expect(validateStaffForm({ ...valid, email: 'notanemail' })).toHaveProperty('email'));
  test('rejects password under 8 chars', () => expect(validateStaffForm({ ...valid, password: 'short' })).toHaveProperty('password'));
  test('accepts password of exactly 8 chars', () => expect(validateStaffForm({ ...valid, password: '12345678' })).not.toHaveProperty('password'));
  test('rejects invalid phone', () => expect(validateStaffForm({ ...valid, phone: 'abc' })).toHaveProperty('phone'));
  test('accepts valid phone', () => expect(validateStaffForm({ ...valid, phone: '+91 9000000000' })).not.toHaveProperty('phone'));
  test('accepts no phone', () => expect(validateStaffForm(valid)).not.toHaveProperty('phone'));
  test('rejects bio over 300 chars', () => expect(validateStaffForm({ ...valid, bio: 'x'.repeat(301) })).toHaveProperty('bio'));
  test('accepts bio at 300 chars', () => expect(validateStaffForm({ ...valid, bio: 'x'.repeat(300) })).not.toHaveProperty('bio'));
});

// ─── Permission toggle logic ─────────────────────────────────────

function togglePermission(current: string[], code: string): string[] {
  return current.includes(code) ? current.filter(p => p !== code) : [...current, code];
}

function toggleModule(current: string[], codes: string[]): string[] {
  const allSelected = codes.every(c => current.includes(c));
  if (allSelected) return current.filter(p => !codes.includes(p));
  return [...new Set([...current, ...codes])];
}

describe('togglePermission', () => {
  test('adds a permission when not present', () => {
    expect(togglePermission([], 'booking.view')).toContain('booking.view');
  });
  test('removes a permission when present', () => {
    expect(togglePermission(['booking.view'], 'booking.view')).not.toContain('booking.view');
  });
  test('preserves other permissions when removing', () => {
    const result = togglePermission(['booking.view', 'booking.create'], 'booking.view');
    expect(result).toContain('booking.create');
  });
  test('does not duplicate existing permission', () => {
    const result = togglePermission(['booking.view'], 'booking.view');
    expect(result.filter(p => p === 'booking.view')).toHaveLength(0);
  });
});

describe('toggleModule', () => {
  const codes = ['booking.view', 'booking.create', 'booking.edit'];

  test('selects all when none selected', () => {
    const result = toggleModule([], codes);
    expect(codes.every(c => result.includes(c))).toBe(true);
  });
  test('deselects all when all selected', () => {
    const result = toggleModule(codes, codes);
    expect(codes.some(c => result.includes(c))).toBe(false);
  });
  test('selects all when some selected', () => {
    const result = toggleModule(['booking.view'], codes);
    expect(codes.every(c => result.includes(c))).toBe(true);
  });
  test('does not duplicate codes', () => {
    const result = toggleModule(['booking.view'], codes);
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
  test('preserves unrelated permissions when deselecting', () => {
    const result = toggleModule([...codes, 'report.view'], codes);
    expect(result).toContain('report.view');
  });
});

// ─── Leave date management ────────────────────────────────────────

function addLeaveDate(existing: string[], newDate: string): { dates: string[]; error?: string } {
  if (!newDate) return { dates: existing, error: 'Select a date' };
  if (existing.includes(newDate)) return { dates: existing, error: 'Date already added' };
  return { dates: [...existing, newDate].sort() };
}

function removeLeaveDate(existing: string[], date: string): string[] {
  return existing.filter(d => d !== date);
}

describe('addLeaveDate', () => {
  test('adds a new date and sorts', () => {
    const { dates } = addLeaveDate(['2026-09-01'], '2026-08-15');
    expect(dates).toEqual(['2026-08-15', '2026-09-01']);
  });
  test('rejects empty date', () => {
    const { error } = addLeaveDate([], '');
    expect(error).toBeTruthy();
  });
  test('rejects duplicate date', () => {
    const { error } = addLeaveDate(['2026-09-01'], '2026-09-01');
    expect(error).toBeTruthy();
  });
  test('returns sorted array on success', () => {
    const { dates } = addLeaveDate(['2026-12-25'], '2026-12-24');
    expect(dates[0]).toBe('2026-12-24');
  });
});

describe('removeLeaveDate', () => {
  test('removes the specified date', () => {
    expect(removeLeaveDate(['2026-09-01', '2026-09-15'], '2026-09-01')).toEqual(['2026-09-15']);
  });
  test('handles removing non-existent date gracefully', () => {
    expect(removeLeaveDate(['2026-09-01'], '2026-12-25')).toEqual(['2026-09-01']);
  });
  test('returns empty array when last date removed', () => {
    expect(removeLeaveDate(['2026-09-01'], '2026-09-01')).toEqual([]);
  });
});

// ─── Permission count helpers ─────────────────────────────────────

function countGranted(permissions: string[], moduleCodes: string[]): number {
  return moduleCodes.filter(c => permissions.includes(c)).length;
}

function totalPermissions(groups: Array<{ codes: string[] }>): number {
  return groups.reduce((sum, g) => sum + g.codes.length, 0);
}

describe('countGranted', () => {
  test('counts only matching permissions', () =>
    expect(countGranted(['booking.view', 'booking.create', 'report.view'],
      ['booking.view', 'booking.create', 'booking.edit'])).toBe(2));
  test('returns 0 when none match', () =>
    expect(countGranted(['report.view'], ['booking.view'])).toBe(0));
  test('returns full count when all match', () =>
    expect(countGranted(['booking.view', 'booking.create'],
      ['booking.view', 'booking.create'])).toBe(2));
});

describe('totalPermissions', () => {
  test('sums all codes across groups', () => {
    const groups = [{ codes: ['a', 'b', 'c'] }, { codes: ['d', 'e'] }];
    expect(totalPermissions(groups)).toBe(5);
  });
  test('returns 0 for empty groups', () =>
    expect(totalPermissions([])).toBe(0));
});
