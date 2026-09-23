'use client';

import { create } from 'zustand';
import { registerPasskey } from './passkey';
import { passkeyApi } from './api';

export type PasskeyRecord = {
  id: string;
  credential_id: string;
  friendly_name: string;
  created_at: string;
  last_used_at?: string | null;
};

type PasskeyState = {
  passkeys: PasskeyRecord[];
  loading: boolean;
  busy: boolean;
  error: string;
  success: string;
  initialized: boolean;
  load: () => Promise<void>;
  add: () => Promise<void>;
  rename: (passkey: PasskeyRecord, friendlyName?: string | null) => Promise<void>;
  remove: (passkey: PasskeyRecord, confirmed?: boolean) => Promise<void>;
  clearMessages: () => void;
  clear: () => void;
};

const messageFromError = (error: any, fallback: string) =>
  error?.response?.data?.message ?? error?.message ?? fallback;

export const usePasskeyStore = create<PasskeyState>((set, get) => ({
  passkeys: [],
  loading: false,
  busy: false,
  error: '',
  success: '',
  initialized: false,

  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: '' });
    try {
      const response = await passkeyApi.list();
      set({ passkeys: Array.isArray(response.data) ? response.data : [], initialized: true });
    } catch (error) {
      set({ error: messageFromError(error, 'Unable to load passkeys'), initialized: true });
    } finally {
      set({ loading: false });
    }
  },

  add: async () => {
    if (get().busy) return;
    set({ busy: true, error: '', success: '' });
    try {
      await registerPasskey();
      await get().load();
      set({ success: 'Passkey registered successfully.' });
    } catch (error) {
      set({ error: messageFromError(error, 'Unable to register passkey') });
    } finally {
      set({ busy: false });
    }
  },

  rename: async (passkey, friendlyName) => {
    const nextName = friendlyName ?? window.prompt('Passkey name', passkey.friendly_name);
    if (nextName === null || !nextName.trim() || get().busy) return;
    set({ busy: true, error: '', success: '' });
    try {
      await passkeyApi.rename(passkey.id, nextName.trim());
      await get().load();
      set({ success: 'Passkey name updated.' });
    } catch (error) {
      set({ error: messageFromError(error, 'Unable to rename passkey') });
    } finally {
      set({ busy: false });
    }
  },

  remove: async (passkey, confirmed) => {
    const shouldRemove =
      confirmed ??
      window.confirm(
        `Remove “${passkey.friendly_name}”? You will no longer be able to use it to sign in.`
      );
    if (!shouldRemove || get().busy) return;
    set({ busy: true, error: '', success: '' });
    try {
      await passkeyApi.remove(passkey.id);
      await get().load();
      set({ success: 'Passkey removed.' });
    } catch (error) {
      set({ error: messageFromError(error, 'Unable to remove passkey') });
    } finally {
      set({ busy: false });
    }
  },

  clearMessages: () => set({ error: '', success: '' }),
  clear: () =>
    set({
      passkeys: [],
      loading: false,
      busy: false,
      error: '',
      success: '',
      initialized: false,
    }),
}));
