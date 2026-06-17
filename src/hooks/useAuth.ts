'use client';
// src/hooks/useAuth.ts
//
// Returns the current authenticated user and helpers.
// Reads from Redux store (hydrated by AuthProvider).
//
// Usage:
//   const { user, role, isLoading, logout } = useAuth();

import { useCallback } from 'react';
import { useRouter }   from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { clearAuth }   from '@/store';
import { clearTokens } from '@/context/AuthProvider';
import type { AuthUser, UserRole } from '@/types';

export interface UseAuthReturn {
  user:        AuthUser | null;
  token:       string | null;
  role:        UserRole | null;
  isLoading:   boolean;
  isHydrated:  boolean;
  isLoggedIn:  boolean;
  logout:      () => void;
}

export function useAuth(): UseAuthReturn {
  const dispatch   = useAppDispatch();
  const router     = useRouter();
  const auth       = useAppSelector(s => s.auth);

  const logout = useCallback(() => {
    clearTokens();
    dispatch(clearAuth());
    router.replace('/login');
  }, [dispatch, router]);

  return {
    user:       auth.user,
    token:      auth.token,
    role:       auth.user?.role ?? null,
    isLoading:  auth.isLoading,
    isHydrated: auth.isHydrated,
    isLoggedIn: !!auth.user,
    logout,
  };
}
