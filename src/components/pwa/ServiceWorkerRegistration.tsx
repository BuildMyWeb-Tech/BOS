'use client';
// src/components/pwa/ServiceWorkerRegistration.tsx
//
// Registers /sw.js on mount. Silent — no UI, no toasts on success.
// Fails silently in unsupported browsers (older Safari versions, etc.)
// rather than throwing, since PWA support is a progressive enhancement,
// not a requirement for the app to function.

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Register after load so it doesn't compete with initial page rendering
    // for network/CPU resources.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Non-fatal — log for debugging, don't surface to the user.
        console.warn('[BOS] Service worker registration failed:', err);
      });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
