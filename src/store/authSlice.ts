// src/store/authSlice.ts
// Redux slice for authentication state.
//
// isHydrated is the critical flag:
//   - starts false (SSR/initial render — we don't know if user is logged in)
//   - set to true by AuthProvider after it reads localStorage + optionally calls /me
//   - useFetch waits for isHydrated = true before making any API request
//   - this eliminates the "cancelled" request in Chrome DevTools caused by
//     firing requests before the token is available

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/types';

export interface AuthState {
  user:         AuthUser | null;
  token:        string | null;
  refreshToken: string | null;
  isLoading:    boolean;
  isHydrated:   boolean; // true after localStorage read + /me call complete
}

const initialState: AuthState = {
  user:         null,
  token:        null,
  refreshToken: null,
  isLoading:    false,
  isHydrated:   false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
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
      state.isHydrated   = true; // hydration complete — token is valid
    },

    clearAuth(state) {
      state.user         = null;
      state.token        = null;
      state.refreshToken = null;
      state.isLoading    = false;
      state.isHydrated   = true; // hydration complete — user is logged out
    },

    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    // Called when a token refresh succeeds — update tokens without changing user
    updateTokens(
      state,
      action: PayloadAction<{ token: string; refreshToken: string }>
    ) {
      state.token        = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
  },
});

export const { setAuth, clearAuth, setLoading, updateTokens } = authSlice.actions;
export default authSlice.reducer;
