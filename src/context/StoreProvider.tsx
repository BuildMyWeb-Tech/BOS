'use client';
// src/context/StoreProvider.tsx
// Provides Redux store to the component tree.
// Must be a client component — wraps the root layout body.

import { Provider } from 'react-redux';
import { store }    from '@/store';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
