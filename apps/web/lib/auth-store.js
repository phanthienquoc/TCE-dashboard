'use client';

import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: '',
  ready: false,
  loading: true,
  hydrated: false,
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken: accessToken || '' }),
  setReady: (ready) => set({ ready }),
  setLoading: (loading) => set({ loading }),
  setHydrated: (hydrated) => set({ hydrated }),
  clearAuth: () => set({ user: null, accessToken: '' }),
}));
