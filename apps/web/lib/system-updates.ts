import { systemUpdatesApi } from './api';

const LAST_SEEN_KEY = 'tce:last-system-update-version';

export type SystemUpdate = {
  id: string;
  version: string;
  title: string;
  message: string;
  release_url: string | null;
  created_at: string;
};

const base64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
};

export async function registerSystemServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function enableSystemUpdateNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    throw new Error('Push notifications are not supported by this browser');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted');

  const registration = await registerSystemServiceWorker();
  if (!registration) throw new Error('Unable to register notification service worker');

  const config = await systemUpdatesApi.config();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(config.data.vapidPublicKey),
    }));

  await systemUpdatesApi.subscribe(subscription.toJSON());
  return subscription;
}

export async function syncGrantedSystemUpdateNotifications() {
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window) ||
    Notification.permission !== 'granted'
  )
    return null;

  const registration = await registerSystemServiceWorker();
  if (!registration) return null;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await systemUpdatesApi.subscribe(subscription.toJSON());
  return subscription;
}

export async function checkLatestSystemUpdate(onUpdate?: (update: SystemUpdate) => void) {
  const response = await systemUpdatesApi.latest();
  const update = response.data?.data as SystemUpdate | null;
  if (!update) return null;

  const previous = window.localStorage.getItem(LAST_SEEN_KEY);
  if (previous && previous !== update.version) onUpdate?.(update);
  window.localStorage.setItem(LAST_SEEN_KEY, update.version);
  return update;
}

export const rememberSystemUpdate = (version: string) => {
  window.localStorage.setItem(LAST_SEEN_KEY, version);
};
