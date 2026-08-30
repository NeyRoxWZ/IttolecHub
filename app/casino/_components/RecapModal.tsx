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
      className="fixed inset-0 z-[230] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent-primary" /> Ta semaine
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">Du lundi au dimanche dernier.</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none"
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
              'rounded-2xl border-4 p-5 text-center mb-3',
              up ? 'border-accent-success bg-accent-success/5' : 'border-accent-secondary bg-accent-secondary/5'
            )}>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Résultat net</div>
              <div className={cn(
                'font-display text-4xl font-black tabular-nums mt-1 flex items-center justify-center gap-2',
                up ? 'text-accent-success' : 'text-accent-secondary'
              )}>
                {up ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
                {up ? '+' : ''}{fmt(data.net)} ₶
              </div>
              {data.rank && (
                <div className="text-[11px] text-tx-muted mt-2">
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
                <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
                  <div className="font-display font-black text-sm tabular-nums truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {data.favouriteGame && (
              <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center gap-2 mb-2">
                <Dices className="h-4 w-4 shrink-0 text-accent-primary" />
                <span className="text-[12px] text-tx-secondary">
                  Ton jeu de la semaine :{' '}
                  <b className="text-tx-base">{GAME_LABELS[data.favouriteGame] || data.favouriteGame}</b>
                  {' '}({data.favouriteGamePlays} manches)
                </span>
              </div>
            )}

            {data.bestDay && data.bestDayNet > 0 && (
              <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center gap-2">
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
          className="mt-4 w-full h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary focus:outline-none"
        >
          À CETTE SEMAINE
        </button>
      </div>
    </div>
  );
}
