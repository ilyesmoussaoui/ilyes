import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api, ApiError } from '../../lib/api';
import type { LoginPayload, LoginResponse, MeResponse, UserSummary } from '../../types/auth';

interface AuthState {
  user: UserSummary | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  hasBootstrapped: boolean;
  lastEmail: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  setLocked: (locked: boolean) => void;
  clear: () => void;
}

interface PersistedAuthState {
  lastEmail: string | null;
  isLocked: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: [],
      isAuthenticated: false,
      isLocked: false,
      isLoading: false,
      hasBootstrapped: false,
      lastEmail: null,

      login: async (payload) => {
        set({ isLoading: true });
        try {
          const data = await api.post<LoginResponse>('/auth/login', payload);
          set({
            user: data.user,
            isAuthenticated: true,
            isLocked: false,
            isLoading: false,
            hasBootstrapped: true,
            lastEmail: data.user.email,
          });
          const me = await api.get<MeResponse>('/auth/me').catch(() => null);
          if (me) {
            set({ permissions: me.permissions, user: me.user });
          }
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // best-effort revocation
        }
        set({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLocked: false,
          isLoading: false,
        });
      },

      unlock: async (password) => {
        const email = get().lastEmail ?? get().user?.email;
        if (!email) {
          throw new ApiError('NO_SESSION', 'No active session to unlock', 401);
        }
        set({ isLoading: true });
        try {
          const data = await api.post<LoginResponse>('/auth/login', {
            email,
            password,
          });
          set({
            user: data.user,
            isAuthenticated: true,
            isLocked: false,
            isLoading: false,
            lastEmail: data.user.email,
          });
          const me = await api.get<MeResponse>('/auth/me').catch(() => null);
          if (me) set({ permissions: me.permissions, user: me.user });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const data = await api.get<MeResponse>('/auth/me');
          set({
            user: data.user,
            permissions: data.permissions,
            isAuthenticated: true,
            isLoading: false,
            hasBootstrapped: true,
            lastEmail: data.user.email,
          });
        } catch {
          set({
            user: null,
            permissions: [],
            isAuthenticated: false,
            isLoading: false,
            hasBootstrapped: true,
          });
        }
      },

      refreshPermissions: async () => {
        if (!get().isAuthenticated) return;
        try {
          const data = await api.get<MeResponse>('/auth/me');
          set({ permissions: data.permissions, user: data.user });
        } catch {
          // Silently fail — next poll will retry.
          // If session expired the 401 handler will clear the store.
        }
      },

      setLocked: (locked) => {
        set({ isLocked: locked });
      },

      clear: () => {
        set({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLocked: false,
          isLoading: false,
        });
      },
    }),
    {
      name: 'sport-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedAuthState => ({
        lastEmail: state.lastEmail,
        isLocked: state.isLocked,
      }),
    },
  ),
);
