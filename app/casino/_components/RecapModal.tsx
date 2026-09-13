'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, TrendingUp, TrendingDown, Trophy, Dices, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { GAME_LABELS } from '@/lib/casino/cosmetics';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** Monday 00:00 UTC of the current week, as a key we can store. */
function weekKey(): string {
  const d = new Date();
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7));
  return u.toISOString().slice(0, 10);
}

const SEEN_KEY = 'itollec_casino_recap_seen';

/**
 * Last week, in one screen.
 *
 * It opens by itself once per week and remembers it did — a recap you have to
 * go looking for is a recap nobody reads, but one that reappears every visit
 * is an obstacle.
 */
export function useRecap() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== weekKey()) setOpen(true);
    } catch {
      // Private browsing: skip it rather than nagging every page load.
    }
  }, []);

  const close = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, weekKey()); } catch {}
    setOpen(false);
  }, []);

  return { open, close, show: () => setOpen(true) };
}

export default function RecapModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    void fetch(`/api/casino/recap?user_id=${user.id}&offset=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, [user]);

  if (!user) return null;

  const up = data && data.net >= 0;
  const nothing = data && data.bets === 0;

  return (
    <div
      className="fixed inset-0 z-[230] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-3xl leading-none flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent-primary" /> Ta semaine
            </h2>
            <p className="text-xs font-bold text-tx-secondary mt-2">Du lundi au dimanche dernier.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!data && <div className="h-40 rounded-2xl border-2 border-brand-border bg-brand-inner animate-pulse" />}

        {nothing && (
          <p className="text-sm text-tx-secondary">
            Tu n&apos;as pas joué la semaine dernière. Rien à raconter, donc — mais la nouvelle
            vient de commencer.
          </p>
        )}

        {data && !nothing && (
          <>
            <div className={cn(
              'rounded-2xl border-[3px] border-brand-border p-5 text-center mb-3',
              up ? 'bg-accent-success shadow-[inset_0_-6px_0_#1E9A55,0_5px_0_#05061A]' : 'bg-accent-secondary shadow-[inset_0_-6px_0_#C92D63,0_5px_0_#05061A]'
            )}>
              <div className="text-xs font-black uppercase tracking-widest text-white">Résultat net</div>
              <div className={cn(
                'font-display text-5xl leading-none tabular-nums mt-1 flex items-center justify-center gap-2 text-white [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]'
              )}>
                {up ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
                {up ? '+' : ''}{fmt(data.net)} ₶
              </div>
              {data.rank && (
                <div className="text-xs font-black text-white mt-2">
                  {data.rank}<sup>e</sup> sur {data.players} joueur{data.players > 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Mises posées', value: fmt(data.bets) },
                { label: 'Total misé', value: `${fmt(data.wagered)} ₶` },
                { label: 'Plus gros gain', value: `${fmt(data.biggestWin)} ₶` },
                { label: 'Meilleur multi.', value: `×${data.biggestMultiplier}` },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-2.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
                  <div className="font-display text-xl leading-tight tabular-nums truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {data.favouriteGame && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center gap-2 mb-2">
                <Dices className="h-4 w-4 shrink-0 text-accent-primary" />
                <span className="text-[12px] text-tx-secondary">
                  Ton jeu de la semaine :{' '}
                  <b className="text-tx-base">{GAME_LABELS[data.favouriteGame] || data.favouriteGame}</b>
                  {' '}({data.favouriteGamePlays} manches)
                </span>
              </div>
            )}

            {data.bestDay && data.bestDayNet > 0 && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 shrink-0 text-accent-primary" />
                <span className="text-[12px] text-tx-secondary">
                  Meilleur jour : <b className="text-tx-base">{data.bestDay}</b>, +{fmt(data.bestDayNet)} ₶
                </span>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => { sfx.click(); onClose(); }}
          className="mt-4 w-full h-14 text-xl rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none disabled:opacity-50"
        >
          À cette semaine
        </button>
      </div>
    </div>
  );
}
