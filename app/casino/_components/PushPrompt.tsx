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
      className="fixed inset-0 z-[390] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={later}
    >
      <div
        className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[22px] shadow-[0_8px_0_#05061A] p-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-prompt-title"
      >
        <div className="h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg flex items-center justify-center mb-4 shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]">
          <Bell className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h2 id="push-prompt-title" className="font-display text-3xl leading-tight">
          Activer les notifications ?
        </h2>
        <p className="text-sm font-bold text-tx-secondary mt-1 mb-4">On te prévient seulement pour :</p>
        <ul className="space-y-2 mb-6">
          {reasons.map((r) => (
            <li key={r} className="flex gap-2.5 items-start rounded-xl border-2 border-brand-border bg-brand-inner px-3 py-2 text-sm font-bold leading-snug text-white">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-md border-2 border-brand-border bg-accent-primary" />
              {r}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            onClick={later}
            disabled={busy}
            className="flex-1 h-14 text-lg rounded-2xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none disabled:opacity-40"
          >
            Plus tard
          </button>
          <button
            onClick={enable}
            disabled={busy}
            className="flex-1 h-14 text-lg rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none disabled:opacity-50"
          >
            {busy ? '…' : 'Activer'}
          </button>
        </div>
      </div>
    </div>
  );
}
