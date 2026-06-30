'use client';
// src/hooks/useFetch.ts
//
// Thin data-fetching hook used across all dashboard pages.
// Injects the auth token automatically, handles loading/error state,
// and exposes a refetch function for mutations that need to refresh.
//
// Usage:
//   const { data, loading, error, refetch } = useFetch<VendorListItem[]>('/api/super-admin/vendors');

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '@/hooks/store';

export interface UseFetchOptions {
  skip?:    boolean;  // set true to prevent fetching (e.g. waiting for an id)
  deps?:    unknown[]; // extra deps that trigger a refetch when changed
}

export interface UseFetchReturn<T> {
  data:     T | null;
  loading:  boolean;
  error:    string | null;
  refetch:  () => void;
}

export function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchReturn<T> {
  const token       = useAppSelector(s => s.auth.token);
  const { skip = false, deps = [] } = options;

  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (skip || !token) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal:  ctrl.signal,
    })
      .then(r => r.json())
      .then(json => {
        if (!json.success) throw new Error(json.error ?? 'Request failed');
        setData(json.data);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message ?? 'Something went wrong');
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, tick, skip, ...deps]);

  return { data, loading, error, refetch };
}
