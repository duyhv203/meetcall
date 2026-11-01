import { create } from 'zustand';
import type { AuthResponse, AuthUser } from '@meetcall/shared';
import { api, setAccessToken } from '../lib/api.js';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;

  setAuth: (user: AuthUser, token: string) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,

  setAuth: (user, token) => {
    setAccessToken(token);
    set({
      user,
      accessToken: token,
      isAuthenticated: true,
      isInitialized: true,
    });
  },

  logout: async () => {
    try {
      await api<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors and clean state anyway
    } finally {
      setAccessToken(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const res = await api<AuthResponse>('/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(res.accessToken);
      set({
        user: res.user,
        accessToken: res.accessToken,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      setAccessToken(null);
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },
}));
