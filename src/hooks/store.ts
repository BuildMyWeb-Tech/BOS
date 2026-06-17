// src/hooks/store.ts
// Typed versions of useDispatch and useSelector.
// Always import from here — never from 'react-redux' directly.

import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';

export const useAppDispatch: () => AppDispatch         = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
