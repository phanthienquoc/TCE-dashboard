'use client';

import { create } from 'zustand';

const initialState = {
  status: 'loading',
  user: null,
  accessToken: '',
};

export const useAuthStore = create((set) => ({
  ...initialState,
  setLoading: () => set({ status: 'loading' }),
  setAuthenticated: (user, accessToken) => set({
    status: 'authenticated',
    user,
    accessToken: accessToken || '',
  }),
  setAnonymous: () => set({
    status: 'anonymous',
    user: null,
    accessToken: '',
  }),
  setToken: (accessToken) => set({ accessToken: accessToken || '' }),
}));
