'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';

/** VAPID keys travel as base64url; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * The notification switch.
 *
 * Deliberately opt-in and never asked for on arrival: a permission prompt
 * fired at a stranger is denied, and a denied permission cannot be asked for
 * again. It only appears once the app can actually use it, which on iOS means
 * only after the site has been added to the home screen.
 */
export default function PushToggle({ className }: { className?: string }) {
  const { user } = useAuth();
  const [supported, setSupported] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;

    void fetch('/api/casino/push')
      .then((r) => r.json())
      .then((d) => { if (d.enabled) setPublicKey(d.publicKey); })
      .catch(() => {});

    void navigator.serviceWorker.register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(!!sub))
      .catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    if (!user) { toast.error('Connecte-toi d’abord.'); return; }
    if (!publicKey) { toast.error('Notifications indisponibles.'); return; }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Ton navigateur a refusé les notifications.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch('/api/casino/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, subscription: sub.toJSON() }),
      });
      if (!res.ok) { toast.error('Enregistrement impossible.'); return; }

      setOn(true);
      sfx.click();
      toast.success('Tu seras prévenu pour ton coffre et l’heure chaude.');
    } catch {
      toast.error('Notifications impossibles sur cet appareil.');
    } finally { setBusy(false); }
  }, [user, publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/casino/push', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'unsubscribe', subscription: { endpoint: sub.endpoint } }),
        });
        await sub.unsubscribe();
      }
      setOn(false);
      toast.success('Notifications coupées.');
    } finally { setBusy(false); }
  }, []);

  if (!supported || !publicKey || !user) return null;

  return (
    <button
      onClick={() => (on ? disable() : enable())}
      disabled={busy}
      title={on ? 'Couper les notifications' : 'Être prévenu pour le coffre et l’heure chaude'}
      className={cn(
        'h-11 px-3 rounded-xl border-2 flex items-center gap-2 focus:outline-none transition-colors',
        on ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
           : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base',
        className
      )}
    >
      {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      <span className="font-display font-black text-[11px]">
        {on ? 'PRÉVENU' : 'ME PRÉVENIR'}
      </span>
    </button>
  );
}
