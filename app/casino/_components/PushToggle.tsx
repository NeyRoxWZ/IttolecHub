'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import {
  currentPushSubscription, fetchPushKey, pushSupported, subscribePush, unsubscribePush,
} from '@/lib/casino/pushClient';

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
    const ok = pushSupported();
    setSupported(ok);
    if (!ok) return;
    void fetchPushKey().then(setPublicKey);
    void currentPushSubscription().then((sub) => setOn(!!sub));
  }, []);

  const enable = useCallback(async () => {
    if (!user) { toast.error('Connecte-toi d’abord.'); return; }
    if (!publicKey) { toast.error('Notifications indisponibles.'); return; }

    setBusy(true);
    const result = await subscribePush(user.id, publicKey);
    setBusy(false);

    if (result === 'ok') {
      setOn(true);
      sfx.click();
      toast.success('Notifications activées.');
    } else if (result === 'denied') {
      toast.error('Ton navigateur a refusé les notifications.');
    } else {
      toast.error('Notifications impossibles sur cet appareil.');
    }
  }, [user, publicKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribePush();
      setOn(false);
      toast.success('Notifications coupées.');
    } finally { setBusy(false); }
  }, []);

  if (!supported || !publicKey || !user) return null;

  return (
    <button
      onClick={() => (on ? disable() : enable())}
      disabled={busy}
      title={on ? 'Couper les notifications' : 'Être prévenu : coffre, missions, récap, pass, cadeaux'}
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
