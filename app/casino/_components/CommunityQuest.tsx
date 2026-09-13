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

/** "3 j 4 h", "5 h 12 min", "8 min" until the given moment. */
export function timeLeft(iso: string): string {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const min = Math.floor(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  if (d > 0) return `encore ${d} j ${h} h`;
  if (h > 0) return `encore ${h} h ${min % 60} min`;
  return `encore ${Math.max(1, min)} min`;
}

/** "lundi à 02:00 (dans 3 j 4 h)", in the player's own time zone. */
export function nextGoalLabel(iso: string): string {
  const at = new Date(iso);
  const when = at.toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à ');
  return `${when} (${timeLeft(iso).replace('encore', 'dans')})`;
}

interface State {
  quest: Quest;
  period?: string;
  endsAt?: string;
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

export default function CommunityQuestPanel() {
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
      'rounded-2xl border-[3px] p-3',
      state.completed ? 'border-accent-success bg-accent-success/10' : 'border-brand-border bg-brand-inner'
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <Users className={cn('h-4 w-4 shrink-0', state.completed ? 'text-accent-success' : 'text-accent-primary')} />
        <span className="font-display text-[12px] leading-tight flex-1 min-w-0">
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

      {state.endsAt && (
        <div className="mb-1.5 text-xs font-bold text-tx-secondary">
          {state.completed ? 'Prochain objectif' : 'Fin de l’objectif'}{' '}
          <b className="text-white">{nextGoalLabel(state.endsAt)}</b>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-tx-muted tabular-nums">
        <span>
          {Math.min(state.progress, state.target).toLocaleString('en-US')} / {state.target.toLocaleString('en-US')} {state.quest.unit}
        </span>
        <span>{state.contributors} joueur{state.contributors > 1 ? 's' : ''}</span>
      </div>

      {/* What the bar is actually worth. Without this the goal reads as a
          chore: a big number to fill with no stated payoff. */}
      <div className="mt-2.5 rounded-xl border-[3px] border-brand-border bg-brand-bg p-2.5">
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

      {canClaim && (
        <div className="mt-3 rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg p-2.5 shadow-[inset_0_-4px_0_#D98E00]">
          <div className="font-display text-lg leading-tight">Ta récompense t&apos;attend !</div>
          <p className="text-[13px] font-bold leading-snug mt-0.5">
            Récupère-la avant la fin de la semaine{state.endsAt ? <> (<b className="tabular-nums">{timeLeft(state.endsAt)}</b>)</> : null} :
            {' '}dès qu&apos;un nouvel objectif commence, elle est perdue.
          </p>
          <button
            onClick={claim}
            disabled={busy}
            className="mt-2 w-full h-11 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display text-lg shadow-[inset_0_-4px_0_#1E9A55,0_3px_0_#05061A] active:translate-y-[3px] transition-transform disabled:opacity-50 focus:outline-none"
          >
            {busy ? '···' : `Récupérer ${state.you!.reward.toLocaleString('en-US')} ₶`}
          </button>
        </div>
      )}
    </div>
  );
}
