'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Target, Trophy, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { GAME_LABELS } from '@/lib/casino/cosmetics';
import { secondsUntilNextChallenge } from '@/lib/casino/challenge';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function countdown(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * The daily challenge.
 *
 * The bankroll on this page is not the player's money — everyone starts the
 * day on the same 10 000 ₶ and the same twenty draws, in the same order. The
 * board therefore ranks decisions rather than luck, which no other screen in
 * the casino can claim.
 */
export default function DefiPage() {
  const { user } = useAuth();
  const { refresh } = useCasinoWallet();
  const [state, setState] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [bet, setBet] = useState('');
  const [last, setLast] = useState<number | null>(null);
  const [left, setLeft] = useState(secondsUntilNextChallenge());

  const load = useCallback(async () => {
    const res = await fetch(`/api/casino/challenge${user ? `?user_id=${user.id}` : ''}`);
    if (res.ok) setState(await res.json());
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setLeft(secondsUntilNextChallenge()), 30_000);
    return () => clearInterval(t);
  }, []);

  const post = async (body: any) => {
    if (!user) { toast.error('Connecte-toi.'); return null; }
    setBusy(true);
    try {
      const res = await fetch('/api/casino/challenge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return null; }
      await load();
      return data;
    } finally { setBusy(false); }
  };

  if (!state) {
    return (
      <main className="min-h-screen bg-transparent p-4">
        <div className="max-w-2xl mx-auto h-64 rounded-2xl border-2 border-brand-border bg-brand-inner animate-pulse" />
      </main>
    );
  }

  const run = state.run;
  const over = run && (run.busted || run.finished);
  const maxBet = run ? Math.floor(run.bankroll * state.maxBetPct) : 0;
  const betValue = Number(bet.replace(/\D/g, '')) || 0;

  return (
    <main className="min-h-screen bg-transparent text-tx-base pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/casino"
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-black leading-none">Défi du jour</h1>
            <p className="text-[11px] text-tx-muted mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> nouveau dans {countdown(left)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 text-[12px] text-tx-secondary space-y-2">
          <p className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-accent-primary mt-0.5" />
            <span>
              Tout le monde reçoit <b className="text-tx-base">exactement les mêmes {state.totalRounds} tirages</b>,
              dans le même ordre, avec la même cagnotte de départ de {fmt(state.startingBankroll)} ₶.
              La chance est identique pour tous : seul compte ce que tu mises à chaque manche.
            </span>
          </p>
          <p className="text-tx-muted">
            Cet argent n&apos;est pas le tien et ne touche pas ton solde. Le podium gagne{' '}
            {state.prizes.map((p: number) => fmt(p)).join(' / ')} ₶.
            Une seule tentative par jour · jeu du jour : {GAME_LABELS[state.game] || state.game}.
          </p>
        </div>

        {!run && (
          <button
            onClick={async () => { vibrate(HAPTIC.MEDIUM); const d = await post({ action: 'start' }); if (d) sfx.bet(); }}
            disabled={busy || !user}
            className="w-full h-16 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none focus:outline-none"
          >
            {user ? 'COMMENCER LE DÉFI' : 'CONNECTE-TOI POUR JOUER'}
          </button>
        )}

        {run && (
          <>
            <div className={cn(
              'rounded-2xl border-4 p-5 text-center',
              run.busted ? 'border-accent-secondary bg-accent-secondary/5'
                : run.bankroll >= state.startingBankroll ? 'border-accent-success bg-accent-success/5'
                : 'border-brand-border bg-brand-card'
            )}>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
                {run.busted ? 'Ruiné' : over ? 'Terminé' : `Manche ${run.round + 1}/${state.totalRounds}`}
              </div>
              <div className="font-display text-5xl font-black tabular-nums mt-1">
                {fmt(run.bankroll)} <span className="text-2xl">₶</span>
              </div>
              {last !== null && (
                <div className={cn(
                  'inline-block mt-2 px-3 py-1 rounded-full font-display font-black text-sm',
                  last > 1 ? 'bg-accent-success/15 text-accent-success' : 'bg-accent-secondary/15 text-accent-secondary'
                )}>
                  ×{last}
                </div>
              )}
            </div>

            {run.past.length > 0 && (
              <div className="flex gap-1 overflow-x-auto pb-1">
                {run.past.map((m: number, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'shrink-0 w-12 rounded-lg border-2 py-1 text-center font-display font-black text-[11px] tabular-nums',
                      m > 1 ? 'border-accent-success/50 bg-accent-success/10 text-accent-success'
                            : 'border-accent-secondary/50 bg-accent-secondary/10 text-accent-secondary'
                    )}
                  >
                    ×{m}
                  </div>
                ))}
              </div>
            )}

            {!over && (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-tx-muted">Ta mise</span>
                  <span className="text-tx-muted tabular-nums">max {fmt(maxBet)} ₶</span>
                </div>
                <input
                  type="text" inputMode="numeric" value={bet}
                  placeholder={String(Math.floor(maxBet / 2))}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, '');
                    setBet(d ? Number(d).toLocaleString('en-US') : '');
                  }}
                  className="w-full h-12 px-3 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black tabular-nums focus:outline-none focus:border-accent-primary"
                />
                <div className="grid grid-cols-4 gap-2">
                  {[0.1, 0.25, 0.5, 1].map((f) => (
                    <button
                      key={f}
                      onClick={() => { sfx.click(); setBet(fmt(Math.max(1, Math.floor(maxBet * f)))); }}
                      className="h-9 rounded-lg border-2 border-brand-border bg-brand-inner font-display font-black text-[11px] text-tx-secondary focus:outline-none"
                    >
                      {f === 1 ? 'MAX' : `${Math.round(f * 100)}%`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    vibrate(HAPTIC.MEDIUM);
                    const d = await post({ bet: betValue });
                    if (d) {
                      setLast(d.multiplier);
                      setBet('');
                      if (d.multiplier > 1) sfx.win(); else sfx.lose();
                      if (d.over) { void refresh(); toast.success('Run terminé'); }
                    }
                  }}
                  disabled={busy || betValue < 1 || betValue > maxBet}
                  className="w-full h-14 rounded-2xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-4 border-brand-border shadow-brutal hover:brightness-110 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0 focus:outline-none"
                >
                  JOUER LA MANCHE
                </button>
              </div>
            )}

            {over && (
              <p className="text-sm text-tx-secondary text-center">
                {run.busted
                  ? 'Tu as tout perdu. Reviens demain pour de nouveaux tirages.'
                  : `Tu finis à ${fmt(run.bankroll)} ₶. Reviens demain.`}
              </p>
            )}
          </>
        )}

        <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
          <h2 className="font-display font-black mb-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent-primary" /> Classement du jour
          </h2>
          {state.board.length === 0 ? (
            <p className="text-[11px] text-tx-muted">Personne n&apos;a encore joué.</p>
          ) : (
            <div className="space-y-1.5">
              {state.board.map((r: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={cn(
                    'w-6 shrink-0 font-display font-black tabular-nums',
                    i === 0 ? 'text-accent-primary' : 'text-tx-muted'
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 min-w-0 truncate font-bold">{r.pseudo}</span>
                  <span className="text-[10px] text-tx-muted shrink-0">
                    {r.busted ? 'ruiné' : r.finished ? 'fini' : `${r.round}/${state.totalRounds}`}
                  </span>
                  <span className="font-display font-black tabular-nums shrink-0 w-24 text-right">
                    {fmt(Number(r.bankroll))} ₶
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
