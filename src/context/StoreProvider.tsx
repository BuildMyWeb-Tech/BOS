'use client';
// src/context/StoreProvider.tsx
// Wraps the entire app with the Redux store.
// Must be at the root layout so store exists before any AuthProvider runs.

import { Provider } from 'react-redux';
import { store }    from '@/store';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
