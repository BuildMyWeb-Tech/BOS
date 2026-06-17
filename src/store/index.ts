// src/store/index.ts
//
// Redux store for BOS client-side state.
// Scope: auth tokens + user profile only.
// Everything else (bookings, products, etc.) is fetched server-side or via SWR.

'use client';

import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser, AuthState } from '@/types';

// ─── Auth Slice ───────────────────────────────────────────────────

const initialAuthState: AuthState = {
  user:         null,
  token:        null,
  refreshToken: null,
  isLoading:    true,   // true until hydration completes
  isHydrated:   false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    // Called by AuthProvider after reading localStorage + /me call
    setAuth(
      state,
      action: PayloadAction<{
        user:         AuthUser;
        token:        string;
        refreshToken: string;
      }>
    ) {
      state.user         = action.payload.user;
      state.token        = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.isLoading    = false;
      state.isHydrated   = true;
    },

    // Called on logout or token expiry
    clearAuth(state) {
      state.user         = null;
      state.token        = null;
      state.refreshToken = null;
      state.isLoading    = false;
      state.isHydrated   = true;
    },

    // Called when hydration is done but no session found
    setHydrated(state) {
      state.isLoading  = false;
      state.isHydrated = true;
    },

    // Optimistic update after /api/auth/me refresh
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const { setAuth, clearAuth, setHydrated, updateUser } = authSlice.actions;

// ─── Store ────────────────────────────────────────────────────────

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState    = ReturnType<typeof store.getState>;
export type AppDispatch  = typeof store.dispatch;
