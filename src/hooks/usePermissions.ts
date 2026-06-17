'use client';
// src/hooks/usePermissions.ts
//
// Permission-checking hook for UI guards.
//
// Usage:
//   const { can, canAny, canAll } = usePermissions();
//   if (can('booking.create')) { ... }

import { useAppSelector } from '@/hooks/store';

export interface UsePermissionsReturn {
  permissions: string[];
  // True if user has this permission (SUPER_ADMIN always returns true)
  can:         (code: string)    => boolean;
  // True if user has ANY of the given codes
  canAny:      (codes: string[]) => boolean;
  // True if user has ALL of the given codes
  canAll:      (codes: string[]) => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const user = useAppSelector(s => s.auth.user);

  const permissions = user?.permissions ?? [];
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const can    = (code: string)    => isSuperAdmin || permissions.includes(code);
  const canAny = (codes: string[]) => isSuperAdmin || codes.some(c => permissions.includes(c));
  const canAll = (codes: string[]) => isSuperAdmin || codes.every(c => permissions.includes(c));

  return { permissions, can, canAny, canAll };
}
