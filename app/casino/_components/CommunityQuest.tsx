'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Trophy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { supabase } from '@/lib/supabase/client';
import type { CommunityQuest as Quest } from '@/lib/casino/community';

interface State {
  quest: Quest;
  progress: number;
  target: number;
  completed: boolean;
  contributors: number;
  top: { pseudo: string; contribution: number }[];
  you: { contribution: number; claimed: boolean; reward: number } | null;
}

/**
 * The goal nobody finishes alone.
 *
 * Every player's bets push the same bar, and the whole point is watching it
 * move while other people play — so it listens to the table rather than
 * polling.
 */
export function useCommunity() {
  const { user } = useAuth();
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/community${qs}`);
    if (res.ok) setState(await res.json());
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase.channel('casino_community_bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casino_community' }, (p) => {
        const row = p.new as { progress: number; target: number; completed_at: string | null };
        setState((prev) => (prev ? {
          ...prev,
          progress: Number(row.progress),
          target: Number(row.target),
          completed: !!row.completed_at,
        } : prev));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return { state, reload: load };
}

export default function CommunityQuestPanel({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { setBalance } = useCasinoWallet();
  const { state, reload } = useCommunity();
  const [busy, setBusy] = useState(false);

  if (!state) return null;

  const pct = Math.min(100, (state.progress / state.target) * 100);
  const canClaim = state.completed && state.you && !state.you.claimed && state.you.reward > 0;

  const claim = async () => {
    if (!user || busy) return;
    setBusy(true);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/community', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      sfx.jackpot();
      setBalance(data.newBalance);
      toast.success(`Objectif commun : +${data.reward.toLocaleString('en-US')} ₶`);
      void reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn(
      'rounded-2xl border-2 p-3',
      state.completed ? 'border-accent-success bg-accent-success/10' : 'border-brand-border bg-brand-inner'
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <Users className={cn('h-4 w-4 shrink-0', state.completed ? 'text-accent-success' : 'text-accent-primary')} />
        <span className="font-display font-black text-[12px] leading-tight flex-1 min-w-0">
          {state.quest.label}
        </span>
        {state.completed && <Check className="h-4 w-4 text-accent-success shrink-0" />}
      </div>

      <div className="h-2.5 rounded-full bg-brand-bg border border-brand-border overflow-hidden mb-1.5">
        <div
          className={cn('h-full transition-[width] duration-700', state.completed ? 'bg-accent-success' : 'bg-accent-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-tx-muted tabular-nums">
        <span>
          {Math.min(state.progress, state.target).toLocaleString('en-US')} / {state.target.toLocaleString('en-US')} {state.quest.unit}
        </span>
        <span>{state.contributors} joueur{state.contributors > 1 ? 's' : ''}</span>
      </div>

      {!compact && (
        <>
          {/* What the bar is actually worth. Without this the goal reads as a
              chore: a big number to fill with no stated payoff. */}
          <div className="mt-2.5 rounded-xl border-2 border-brand-border bg-brand-bg p-2.5">
            <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted mb-1">
              Si la barre se remplit
            </div>
            <div className="text-[11px] text-tx-secondary leading-relaxed">
              <b className="text-accent-success tabular-nums">{state.quest.reward.toLocaleString('en-US')} ₶</b>
              {' '}pour chaque joueur qui a participé, plus{' '}
              <b className="text-accent-primary tabular-nums">{state.quest.pool.toLocaleString('en-US')} ₶</b>
              {' '}partagés entre eux au prorata de ce que chacun a poussé.
            </div>
          </div>

          {state.you && state.you.contribution > 0 && (
            <div className="mt-2 text-[11px] text-tx-secondary">
              Ta part : <b className="text-tx-base tabular-nums">{state.you.contribution.toLocaleString('en-US')}</b>
              {' · '}
              {state.completed
                ? <>récompense <b className="text-accent-success tabular-nums">{state.you.reward.toLocaleString('en-US')} ₶</b></>
                : <>gain estimé <b className="text-accent-primary tabular-nums">{state.you.reward.toLocaleString('en-US')} ₶</b></>}
            </div>
          )}

          {state.top.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted mb-1 flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Ceux qui poussent
              </div>
              <div className="space-y-0.5">
                {state.top.slice(0, 5).map((t, i) => (
                  <div key={t.pseudo} className="flex items-center gap-2 text-[11px]">
                    <span className="w-4 text-tx-muted font-black">{i + 1}</span>
                    <span className="truncate flex-1">{t.pseudo}</span>
                    <span className="font-bold text-tx-secondary tabular-nums">
                      {t.contribution.toLocaleString('en-US')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-tx-muted mt-2 leading-snug">
            {state.completed
              ? 'Objectif atteint. Tous ceux qui ont participé sont payés.'
              : 'Personne ne peut le finir seul — chaque partie de chaque joueur fait monter la barre.'}
          </p>
        </>
      )}

      {canClaim && (
        <button
          onClick={claim}
          disabled={busy}
          className="mt-3 w-full h-10 rounded-xl border-2 border-accent-success bg-accent-success text-brand-bg font-display font-black text-[11px] tracking-widest hover:brightness-110 disabled:opacity-50 focus:outline-none"
        >
          {busy ? '···' : `RÉCLAMER ${state.you!.reward.toLocaleString('en-US')} ₶`}
        </button>
      )}
    </div>
  );
}
