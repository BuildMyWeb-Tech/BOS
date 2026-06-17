'use client';
// src/hooks/useModules.ts
//
// Module flag hook. Reads enabled modules for the current tenant.
// Fetches once from /api/tenants/me and caches in sessionStorage.
//
// Usage:
//   const { isEnabled, modules, isLoading } = useModules();
//   if (isEnabled('booking')) { ... }

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { TenantModules, ModuleFlag } from '@/types';

const CACHE_KEY = 'bos_modules';

const DEFAULT_MODULES: TenantModules = {
  booking:   false,
  inventory: false,
  billing:   false,
  ecommerce: false,
};

export interface UseModulesReturn {
  modules:   TenantModules;
  isEnabled: (flag: ModuleFlag) => boolean;
  isLoading: boolean;
}

export function useModules(): UseModulesReturn {
  const { token, role, isLoggedIn } = useAuth();

  const [modules,   setModules]   = useState<TenantModules>(DEFAULT_MODULES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Super Admin has no tenant — all modules shown
    if (role === 'SUPER_ADMIN') {
      setModules({ booking: true, inventory: true, billing: true, ecommerce: true });
      setIsLoading(false);
      return;
    }

    if (!isLoggedIn || !token) {
      setIsLoading(false);
      return;
    }

    // Try session cache first
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setModules(JSON.parse(cached));
        setIsLoading(false);
        return;
      } catch { /* cache corrupt — refetch */ }
    }

    // Fetch from API
    fetch('/api/tenants/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data?.tenant?.modules) {
          const m = json.data.tenant.modules as TenantModules;
          setModules(m);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(m));
        }
      })
      .catch(() => { /* silently fail — keep defaults */ })
      .finally(() => setIsLoading(false));
  }, [token, role, isLoggedIn]);

  const isEnabled = (flag: ModuleFlag) => modules[flag] === true;

  return { modules, isEnabled, isLoading };
}
