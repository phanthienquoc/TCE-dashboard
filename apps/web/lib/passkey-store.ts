'use client';

import { create } from 'zustand';
import { registerPasskey } from './passkey';
import { passkeyApi } from './api';
import { isApiRequestCancelled, normalizeApiError } from './api-errors';

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

let loadController: AbortController | null = null;
let requestVersion = 0;
let busyVersion = 0;

const messageFromError = (error: unknown, fallback: string) =>
  isApiRequestCancelled(error) ? '' : normalizeApiError(error, fallback).message;

export const usePasskeyStore = create<PasskeyState>((set, get) => ({
  passkeys: [],
  loading: false,
  busy: false,
  error: '',
  success: '',
  initialized: false,

  load: async () => {
    if (get().loading) return;
    const controller = new AbortController();
    loadController = controller;
    const version = ++requestVersion;
    set({ loading: true, error: '' });
    try {
      const response = await passkeyApi.list(controller.signal);
      if (controller.signal.aborted || version !== requestVersion) return;
      set({ passkeys: Array.isArray(response.data) ? response.data : [], initialized: true });
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion) return;
      set({ error: messageFromError(error, 'Unable to load passkeys'), initialized: true });
    } finally {
      if (version === requestVersion) set({ loading: false });
      if (loadController === controller) loadController = null;
    }
  },

  add: async () => {
    if (get().busy) return;
    const version = ++busyVersion;
    set({ busy: true, error: '', success: '' });
    try {
      await registerPasskey();
      if (version !== busyVersion) return;
      await get().load();
      if (version === busyVersion) set({ success: 'Passkey registered successfully.' });
    } catch (error) {
      if (version === busyVersion) set({ error: messageFromError(error, 'Unable to register passkey') });
    } finally {
      if (version === busyVersion) set({ busy: false });
    }
  },

  rename: async (passkey, friendlyName) => {
    const nextName = friendlyName ?? window.prompt('Passkey name', passkey.friendly_name);
    if (nextName === null || !nextName.trim() || get().busy) return;
    const version = ++busyVersion;
    set({ busy: true, error: '', success: '' });
    try {
      await passkeyApi.rename(passkey.id, nextName.trim());
      if (version !== busyVersion) return;
      await get().load();
      if (version === busyVersion) set({ success: 'Passkey name updated.' });
    } catch (error) {
      if (version === busyVersion) set({ error: messageFromError(error, 'Unable to rename passkey') });
    } finally {
      if (version === busyVersion) set({ busy: false });
    }
  },

  remove: async (passkey, confirmed) => {
    const shouldRemove =
      confirmed ??
      window.confirm(
        `Remove “${passkey.friendly_name}”? You will no longer be able to use it to sign in.`
      );
    if (!shouldRemove || get().busy) return;
    const version = ++busyVersion;
    set({ busy: true, error: '', success: '' });
    try {
      await passkeyApi.remove(passkey.id);
      if (version !== busyVersion) return;
      await get().load();
      if (version === busyVersion) set({ success: 'Passkey removed.' });
    } catch (error) {
      if (version === busyVersion) set({ error: messageFromError(error, 'Unable to remove passkey') });
    } finally {
      if (version === busyVersion) set({ busy: false });
    }
  },

  clearMessages: () => set({ error: '', success: '' }),
  clear: () => {
    requestVersion += 1;
    busyVersion += 1;
    loadController?.abort();
    loadController = null;
    set({
      passkeys: [],
      loading: false,
      busy: false,
      error: '',
      success: '',
      initialized: false,
    });
  },
}));
