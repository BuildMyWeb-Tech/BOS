'use client';
// src/hooks/useFetch.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppSelector } from '@/hooks/store';

export interface UseFetchOptions {
  skip?: boolean;
  deps?: unknown[];
}

export interface UseFetchReturn<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
  refetch: () => void;
}

export function useFetch<T>(
  url: string,
  options: UseFetchOptions = {}
): UseFetchReturn<T> {
  const token      = useAppSelector(s => s.auth.token);
  const isHydrated = useAppSelector(s => s.auth.isHydrated);
  const { skip = false, deps = [] } = options;

  const [data,    setData]    = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [tick,    setTick]    = useState(0);

  // Generation counter — each fetch gets a unique number.
  // Responses from older fetches are discarded when a newer one is in flight.
  const generationRef = useRef(0);
  const abortRef      = useRef<AbortController | null>(null);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    // KEY: wait for localStorage hydration before any fetch.
    // Prevents the race between "token=null first render" and "token set by AuthProvider".
    if (!isHydrated) {
      setLoading(true);
      return;
    }

    if (skip || !token) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Capture this fetch's generation number
    const generation = ++generationRef.current;

    setLoading(true);
    setError(null);

    fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      signal:  ctrl.signal,
    })
      .then(r => r.json())
      .then(json => {
        // A newer fetch already completed — discard this stale response
        if (generationRef.current !== generation) return;
        if (!json.success) throw new Error(json.error ?? 'Request failed');
        setData(json.data);
        setError(null);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        if (generationRef.current !== generation) return;
        setError(err.message ?? 'Something went wrong');
      })
      .finally(() => {
        // Only clear loading spinner for the current generation
        if (generationRef.current === generation) {
          setLoading(false);
        }
      });

    return () => { ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, isHydrated, tick, skip, ...deps]);

  return { data, loading, error, refetch };
}