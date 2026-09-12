/**
 * Browser side of push notifications, shared by the rail switch and the
 * prompt shown when the installed app opens.
 */

/** VAPID keys travel as base64url; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** Opened from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** The server's public key, or null when push is not configured. */
export async function fetchPushKey(): Promise<string | null> {
  try {
    const d = await fetch('/api/casino/push').then((r) => r.json());
    return d.enabled ? d.publicKey : null;
  } catch {
    return null;
  }
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export type SubscribeResult = 'ok' | 'denied' | 'unavailable' | 'error';

/**
 * Asks for the permission and registers this device. Must run from a tap:
 * iOS ignores a permission request that no gesture started.
 */
export async function subscribePush(userId: string, publicKey?: string | null): Promise<SubscribeResult> {
  if (!pushSupported()) return 'unavailable';
  const key = publicKey ?? await fetchPushKey();
  if (!key) return 'unavailable';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    await navigator.serviceWorker.register('/sw.js');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });

    const res = await fetch('/api/casino/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, subscription: sub.toJSON() }),
    });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

export async function unsubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/casino/push', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', subscription: { endpoint: sub.endpoint } }),
  });
  await sub.unsubscribe();
}
