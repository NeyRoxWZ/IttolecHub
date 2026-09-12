'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { fetchPushKey, isStandalone, pushSupported, subscribePush } from '@/lib/casino/pushClient';

const DISMISS_KEY = 'itollec_push_prompt_later';
/** "Plus tard" really means later: two weeks before asking again. */
const ASK_AGAIN_MS = 14 * 24 * 3600_000;

const REASONS = [
  'Ton coffre du jour, avant que ta série casse',
  'Les nouvelles missions et le défi du jour',
  'Ton récap de la semaine, le lundi',
  'Le nouveau Frenly Pass, chaque mois',
  'Les cadeaux que tes potes t’envoient',
];

/**
 * Offers notifications when the casino is opened as an installed app.
 *
 * Only there: in a browser tab the permission is worth less (iOS cannot even
 * grant it) and a prompt thrown at a visitor is refused. This is our own
 * dialog, not the browser's — the browser's prompt only fires once the player
 * taps "Activer", so a "not now" here never burns the one real request.
 */
export default function PushPrompt({ reasons = REASONS }: { reasons?: string[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !pushSupported() || !isStandalone()) return;
    if (Notification.permission !== 'default') return;
    try {
      const later = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - later < ASK_AGAIN_MS) return;
    } catch {
      return;
    }

    let cancelled = false;
    // Let the page settle first; opening on a blank screen feels like a trap.
    const timer = setTimeout(() => {
      void fetchPushKey().then((k) => {
        if (cancelled || !k) return;
        setKey(k);
        setOpen(true);
      });
    }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [user]);

  if (!open || !user) return null;

  const later = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    const result = await subscribePush(user.id, key);
    setBusy(false);
    setOpen(false);
    if (result === 'ok') toast.success('Notifications activées.');
    else if (result === 'denied') toast.error('Notifications refusées. Tu peux les réactiver dans les réglages du téléphone.');
    else toast.error('Notifications impossibles sur cet appareil.');
  };

  return (
    <div
      className="fixed inset-0 z-[390] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={later}
    >
      <div
        className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[28px] shadow-brutal p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
      >
        <div className="h-12 w-12 rounded-2xl border-2 border-accent-primary bg-accent-primary/10 text-accent-primary flex items-center justify-center mb-4">
          <Bell className="h-6 w-6" />
        </div>
        <h2 id="push-prompt-title" className="font-display text-xl font-black leading-tight">
          Activer les notifications ?
        </h2>
        <p className="text-[12px] text-tx-muted mt-1 mb-4">On te prévient seulement pour :</p>
        <ul className="space-y-2 mb-6">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2.5 text-[13px] leading-snug text-tx-secondary">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
              {r}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            onClick={later}
            disabled={busy}
            className="flex-1 h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary hover:text-tx-base focus:outline-none"
          >
            PLUS TARD
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="flex-1 h-12 rounded-xl bg-accent-primary text-brand-bg font-display font-black text-xs tracking-wider border-2 border-brand-border focus:outline-none disabled:opacity-60"
          >
            {busy ? '…' : 'ACTIVER'}
          </button>
        </div>
      </div>
    </div>
  );
}
