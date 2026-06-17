'use client';
// src/context/AuthProvider.tsx
//
// Hydrates Redux auth state on app mount:
//   1. Reads token + refreshToken from localStorage
//   2. Verifies with GET /api/auth/me
//   3. On success → setAuth (user, token, refreshToken in store)
//   4. On failure / expired → clearAuth → redirect to /login
//
// Wraps the dashboard layout so every server component child
// has guaranteed auth context available via useAuth().

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { setAuth, clearAuth, setHydrated } from '@/store';
import type { AuthUser } from '@/types';

const TOKEN_KEY         = 'bos_token';
const REFRESH_TOKEN_KEY = 'bos_refresh_token';

// Public paths that don't need auth
const PUBLIC_PATHS = ['/login', '/register'];

interface Props {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: Props) {
  const dispatch  = useAppDispatch();
  const isHydrated = useAppSelector(s => s.auth.isHydrated);
  const router    = useRouter();
  const pathname  = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    dispatch(clearAuth());
    router.replace('/login');
  }, [dispatch, router]);

  const tryRefresh = useCallback(async (refreshToken: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success) return null;
      return json.data.token as string;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    async function hydrate() {
      const token        = localStorage.getItem(TOKEN_KEY);
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      // No token at all → clear and redirect if on a protected path
      if (!token) {
        dispatch(setHydrated());
        if (!PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
          router.replace('/login');
        }
        return;
      }

      // Try /api/auth/me with current token
      let meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      let activeToken = token;

      // Token expired → try refresh
      if (meRes.status === 401 && refreshToken) {
        const newToken = await tryRefresh(refreshToken);
        if (newToken) {
          localStorage.setItem(TOKEN_KEY, newToken);
          activeToken = newToken;
          meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${newToken}` },
          });
        }
      }

      if (!meRes.ok) {
        logout();
        return;
      }

      const json = await meRes.json();
      if (!json.success) { logout(); return; }

      const me = json.data.user;
      const user: AuthUser = {
        id:          me.id,
        name:        me.name,
        email:       me.email,
        image:       me.image ?? '',
        role:        me.role,
        tenantId:    me.tenantId,
        permissions: me.permissions,
      };

      dispatch(setAuth({ user, token: activeToken, refreshToken: refreshToken ?? '' }));
    }

    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show nothing during hydration to prevent flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Token storage helpers (used by login page) ───────────────────

export function saveTokens(token: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
