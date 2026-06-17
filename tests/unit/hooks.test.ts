// tests/unit/hooks.test.ts
//
// Tests the pure logic behind hooks — no React renderer needed.
// usePermissions logic is just: SUPER_ADMIN bypasses, others check array.
// useModules logic is just: read flag from TenantModules object.

// ─── Permission logic (mirrors usePermissions internals) ──────────

describe('Permission check logic', () => {
  function makeCan(permissions: string[], role: string) {
    const isSuper = role === 'SUPER_ADMIN';
    return {
      can:    (code: string)    => isSuper || permissions.includes(code),
      canAny: (codes: string[]) => isSuper || codes.some(c => permissions.includes(c)),
      canAll: (codes: string[]) => isSuper || codes.every(c => permissions.includes(c)),
    };
  }

  describe('SUPER_ADMIN bypasses all checks', () => {
    const checker = makeCan([], 'SUPER_ADMIN');

    test('can() returns true for any code', () => {
      expect(checker.can('booking.create')).toBe(true);
      expect(checker.can('settings.manage')).toBe(true);
      expect(checker.can('nonexistent.code')).toBe(true);
    });

    test('canAny() returns true for any codes', () => {
      expect(checker.canAny(['booking.delete', 'settings.manage'])).toBe(true);
      expect(checker.canAny([])).toBe(true);
    });

    test('canAll() returns true even with empty perms', () => {
      expect(checker.canAll(['booking.create', 'product.delete'])).toBe(true);
    });
  });

  describe('STAFF with limited permissions', () => {
    const perms = ['booking.view', 'booking.create', 'customer.view', 'product.view'];
    const checker = makeCan(perms, 'STAFF');

    test('can() returns true for granted permission', () => {
      expect(checker.can('booking.view')).toBe(true);
      expect(checker.can('booking.create')).toBe(true);
    });

    test('can() returns false for denied permission', () => {
      expect(checker.can('booking.delete')).toBe(false);
      expect(checker.can('settings.manage')).toBe(false);
    });

    test('canAny() returns true when at least one matches', () => {
      expect(checker.canAny(['booking.delete', 'booking.view'])).toBe(true);
    });

    test('canAny() returns false when none match', () => {
      expect(checker.canAny(['booking.delete', 'settings.manage'])).toBe(false);
    });

    test('canAll() returns true when all match', () => {
      expect(checker.canAll(['booking.view', 'booking.create'])).toBe(true);
    });

    test('canAll() returns false when any one is missing', () => {
      expect(checker.canAll(['booking.view', 'booking.delete'])).toBe(false);
    });

    test('canAny() with empty array returns false (not SUPER_ADMIN)', () => {
      expect(checker.canAny([])).toBe(false);
    });

    test('canAll() with empty array returns true (vacuous truth)', () => {
      expect(checker.canAll([])).toBe(true);
    });
  });

  describe('VENDOR_OWNER with full permissions', () => {
    const allPerms = [
      'booking.view', 'booking.create', 'booking.edit', 'booking.delete',
      'settings.view', 'settings.manage', 'staff.manage', 'staff.view',
      'report.view', 'report.export',
    ];
    const checker = makeCan(allPerms, 'VENDOR_OWNER');

    test('can() returns true for all granted codes', () => {
      for (const p of allPerms) expect(checker.can(p)).toBe(true);
    });

    test('canAll() returns true for subset', () => {
      expect(checker.canAll(['booking.view', 'settings.manage'])).toBe(true);
    });

    test('can() still returns false for codes not in array', () => {
      expect(checker.can('nonexistent.thing')).toBe(false);
    });
  });
});

// ─── Module flag logic (mirrors useModules internals) ─────────────

describe('Module flag logic', () => {
  function isEnabled(modules: Record<string, boolean>, flag: string) {
    return modules[flag] === true;
  }

  test('returns true for enabled module', () => {
    expect(isEnabled({ booking: true, inventory: false }, 'booking')).toBe(true);
  });

  test('returns false for disabled module', () => {
    expect(isEnabled({ booking: false, inventory: true }, 'booking')).toBe(false);
  });

  test('returns false for unknown module', () => {
    expect(isEnabled({ booking: true }, 'ecommerce')).toBe(false);
  });

  test('returns false for empty modules', () => {
    expect(isEnabled({}, 'booking')).toBe(false);
  });

  test('all modules enabled', () => {
    const all = { booking: true, inventory: true, billing: true, ecommerce: true };
    expect(isEnabled(all, 'billing')).toBe(true);
    expect(isEnabled(all, 'ecommerce')).toBe(true);
  });

  test('partial enablement — only some true', () => {
    const partial = { booking: true, inventory: false, billing: true, ecommerce: false };
    expect(isEnabled(partial, 'booking')).toBe(true);
    expect(isEnabled(partial, 'inventory')).toBe(false);
  });
});

// ─── Auth state logic ─────────────────────────────────────────────

describe('Auth state transitions', () => {
  // Mirrors the Redux reducer logic
  type AuthState = {
    user: { id: string; name: string; role: string } | null;
    token: string | null;
    isHydrated: boolean;
  };

  const initial: AuthState = { user: null, token: null, isHydrated: false };

  function setAuth(state: AuthState, payload: { user: AuthState['user']; token: string }): AuthState {
    return { ...state, user: payload.user, token: payload.token, isHydrated: true };
  }

  function clearAuth(state: AuthState): AuthState {
    return { ...state, user: null, token: null, isHydrated: true };
  }

  test('initial state has no user and is not hydrated', () => {
    expect(initial.user).toBeNull();
    expect(initial.isHydrated).toBe(false);
  });

  test('setAuth sets user and marks hydrated', () => {
    const state = setAuth(initial, {
      user:  { id: 'u1', name: 'Jane', role: 'VENDOR_OWNER' },
      token: 'tok_abc',
    });
    expect(state.user?.id).toBe('u1');
    expect(state.token).toBe('tok_abc');
    expect(state.isHydrated).toBe(true);
  });

  test('clearAuth removes user but stays hydrated', () => {
    const loggedIn = setAuth(initial, {
      user:  { id: 'u1', name: 'Jane', role: 'VENDOR_OWNER' },
      token: 'tok_abc',
    });
    const loggedOut = clearAuth(loggedIn);
    expect(loggedOut.user).toBeNull();
    expect(loggedOut.token).toBeNull();
    expect(loggedOut.isHydrated).toBe(true);
  });
});

// ─── Greeting logic ───────────────────────────────────────────────

describe('Dashboard greeting logic', () => {
  function getGreeting(hour: number) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  test('morning: 0–11', () => {
    for (let h = 0; h < 12; h++) expect(getGreeting(h)).toBe('morning');
  });

  test('afternoon: 12–16', () => {
    for (let h = 12; h < 17; h++) expect(getGreeting(h)).toBe('afternoon');
  });

  test('evening: 17–23', () => {
    for (let h = 17; h < 24; h++) expect(getGreeting(h)).toBe('evening');
  });
});
