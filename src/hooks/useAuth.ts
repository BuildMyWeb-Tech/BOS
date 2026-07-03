// src/hooks/useAuth.ts
// Convenience wrapper over auth Redux state.
// Pages use this instead of reaching into the store directly.

import { useCallback } from 'react';
import { useRouter }   from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/hooks/store';
import { clearAuth }   from '@/store/authSlice';
import { clearTokens } from '@/context/AuthProvider';
import type { UserRole } from '@/lib/auth';

export function useAuth() {
  const dispatch = useAppDispatch();
  const router   = useRouter();

  const user         = useAppSelector(s => s.auth.user);
  const token        = useAppSelector(s => s.auth.token);
  const isHydrated   = useAppSelector(s => s.auth.isHydrated);

  const isLoggedIn = !!user && !!token;
  const role       = user?.role as UserRole | null;

  const logout = useCallback(() => {
    clearTokens();
    dispatch(clearAuth());
    router.replace('/login');
  }, [dispatch, router]);

  return { user, token, isHydrated, isLoggedIn, role, logout };
}
