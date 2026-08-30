'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Users, TrendingUp, TrendingDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { CASINO_GAMES } from '@/lib/casino/games';
import {
  enterPotMode, leavePotMode, setArenaBack,
  potMode, subscribePotMode, potModeServer,
} from '@/lib/casino/potMode';
import { ARENA_GAMES } from '../_components/ArenaGames';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * The run, once it has started.
 *
 * For the length of the run the group does not go back to the casino: they
 * stay here and the games are mounted inside this screen instead of being
 * navigated to. That is the whole point of the lock — the pot is one shared
 * balance and it only makes sense while everyone is looking at it.
 *
 * Their own money is not converted into anything. It sits untouched in their
 * wallet; the arena simply bets a different number for as long as it is open.
 */
export default function Arena({
  code, pot: initialPot, seedPot, remaining, members, feed, walletBalance, hostPseudo,
}: {
  code: string;
  /** Only the starting value: the live one is read from pot mode below. */
  pot: number;
  seedPot: number;
  remaining: number;
  members: any[];
  feed: any[];
  walletBalance: number;
  hostPseudo?: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);

  // The pot is read from the same place the games bet against, so our own
  // settlements and other players' bets land on one number.
  const mode = useSyncExternalStore(subscribePotMode, potMode, potModeServer);
  const pot = mode.active ? mode.pot : initialPot;

  // Everything the games bet against comes from here while this is mounted.
  useEffect(() => {
    enterPotMode({ pot: initialPot, seedPot, endsAt: null, code });
    return () => { leavePotMode(); setArenaBack(null); };
    // Only on mount: later pot changes arrive through setPot, and re-entering
    // would clobber a fresher value pushed by another player's bet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setArenaBack(() => setPlaying(null));
    return () => setArenaBack(null);
  }, []);

  // The back button and gestures would drop them out of a run they cannot
  // leave, so a sacrificial history entry swallows them.
  useEffect(() => {
    window.history.pushState({ arena: true }, '');
    const onPop = () => {
      window.history.pushState({ arena: true }, '');
      setPlaying(null);
    };
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, []);

  const delta = seedPot > 0 ? pot / seedPot : 1;
  const up = delta >= 1;
  const Game = playing ? ARENA_GAMES[playing] : null;

  return (
    <main className="min-h-screen bg-transparent text-tx-base">
      {/* The run's own header, always on top of whatever game is open: the
          number on screen belongs to the group and the clock is running. */}
      <div className={cn(
        'sticky top-0 z-[150] border-b-4 backdrop-blur-md',
        up ? 'border-accent-success bg-brand-bg/90' : 'border-accent-secondary bg-brand-bg/90'
      )}>
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3">
          <div className={cn(
            'h-10 w-10 shrink-0 rounded-xl border-2 flex items-center justify-center',
            up ? 'border-accent-success text-accent-success' : 'border-accent-secondary text-accent-secondary'
          )}>
            <Lock className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-display font-black text-lg sm:text-xl tabular-nums flex items-center gap-2">
              {fmt(pot)} ₶
              <span className={cn(
                'inline-flex items-center gap-0.5 text-xs',
                up ? 'text-accent-success' : 'text-accent-secondary'
              )}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                ×{delta.toFixed(2)}
              </span>
            </div>
            <div className="text-[10px] font-bold text-tx-muted truncate">
              Cagnotte du groupe · ton argent à toi ({fmt(walletBalance)} ₶) n&apos;est pas touché
            </div>
          </div>

          <div className="shrink-0 text-right leading-tight">
            <div className="font-display font-black text-xl tabular-nums">
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
            </div>
            <div className="text-[9px] font-bold text-tx-muted">avant le partage</div>
          </div>
        </div>
      </div>

      {Game ? (
        <Game />
      ) : (
        <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {CASINO_GAMES.map((game) => {
              const Icon = game.icon;
              return (
                <button
                  key={game.slug}
                  onClick={() => { sfx.click(); setPlaying(game.slug); }}
                  className="group rounded-2xl border-4 border-brand-border bg-brand-card p-3 flex flex-col items-center justify-center gap-2 shadow-brutal transition-all hover:border-accent-primary hover:-translate-y-1 active:translate-y-0 focus:outline-none min-h-[112px]"
                >
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5 group-hover:border-accent-primary group-hover:scale-105 transition-all">
                    <Icon className="h-6 w-6 text-accent-primary" />
                  </div>
                  <span className="font-display font-black text-[12px] leading-tight text-center">{game.name}</span>
                  <span className="text-[10px] font-bold text-tx-muted">Redistribution {game.rtp}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-accent-primary" />
                <span className="font-display font-black text-sm">
                  Le groupe · code {code}
                </span>
              </div>
              <div className="space-y-1.5">
                {members.map((m: any) => {
                  const share = seedPot > 0 ? Number(m.contribution) / seedPot : 0;
                  return (
                    <div key={m.user_id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 min-w-0 truncate font-bold">
                        {m.pseudo}
                        {m.pseudo === hostPseudo && (
                          <span className="ml-1.5 text-[9px] font-black uppercase text-accent-primary">hôte</span>
                        )}
                      </span>
                      <span className="text-[11px] text-tx-muted tabular-nums shrink-0">
                        {Math.round(share * 100)}%
                      </span>
                      <span className="font-display font-black tabular-nums shrink-0 w-24 text-right">
                        {fmt(Math.floor(pot * share))} ₶
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-tx-muted mt-3">
                Ce que chacun récupérerait si la partie s&apos;arrêtait maintenant.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">
                Ce que fait le groupe
              </div>
              {feed.length === 0 ? (
                <p className="text-[11px] text-tx-muted">Personne n&apos;a encore misé.</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {[...feed].reverse().map((f: any, i: number) => (
                    <div key={`${f.at}-${i}`} className="flex items-center gap-2 text-[11px]">
                      <span className="font-bold truncate flex-1 min-w-0">{f.pseudo}</span>
                      <span className="text-tx-muted truncate shrink-0">{f.game}</span>
                      <span className={cn(
                        'font-display font-black tabular-nums shrink-0 w-20 text-right',
                        f.amount >= 0 ? 'text-accent-success' : 'text-accent-secondary'
                      )}>
                        {f.amount >= 0 ? '+' : ''}{fmt(f.amount)} ₶
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
