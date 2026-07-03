'use client';
// src/context/AuthProvider.tsx

import { useEffect, useRef } from 'react';
import { useRouter }         from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { setAuth, clearAuth } from '@/store/authSlice';

export function saveTokens(token: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('bos_token',         token);
  localStorage.setItem('bos_refresh_token', refreshToken);
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('bos_token');
  localStorage.removeItem('bos_refresh_token');
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('bos_token');
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('bos_refresh_token');
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch     = useAppDispatch();
  const router       = useRouter();
  const isHydrated   = useAppSelector(s => s.auth.isHydrated);
  const hydratingRef = useRef(false);

  useEffect(() => {
    if (isHydrated || hydratingRef.current) return;
    hydratingRef.current = true;

    const token        = getStoredToken();
    const refreshToken = getStoredRefreshToken();

    if (!token) {
      dispatch(clearAuth());
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: 'Bearer ' + token },
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error('Token invalid');
        dispatch(setAuth({ user: json.data.user, token, refreshToken: refreshToken ?? '' }));
      })
      .catch(() => {
        clearTokens();
        dispatch(clearAuth());
        router.replace('/login');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ALWAYS render children — no conditional rendering.
  // Never show a loading spinner here — that causes server/client HTML mismatch
  // because the server always sees isHydrated=false (no localStorage on server).
  return <>{children}</>;
}
