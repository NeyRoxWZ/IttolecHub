'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import GameIcon from '@/components/GameIcon';
import ReactionButton from './ReactionButton';

interface GameLayoutProps {
  children: ReactNode;
  gameTitle: string;
  roundCount: number;
  maxRounds: number;
  /** Clock text; "--" when the phase has no deadline. */
  timer: string;
  timeLeft?: number;
  className?: string;
  voteToLobby?: ReactNode;
  isConnected?: boolean;
  /** Length of the current phase in seconds, for the progress bar. */
  maxTime?: number;
  /** Game id, for its icon in the header. */
  gameId?: string;
}

/**
 * The frame of every multiplayer game: exactly one screen tall, never a page
 * scroll. A compact header (icon, title, round, clock, reactions, back to the
 * room) and the game area filling the rest.
 */
export default function GameLayout({
  children, gameTitle, roundCount, maxRounds, timer, timeLeft = 0, className, voteToLobby, isConnected = true, maxTime = 30, gameId,
}: GameLayoutProps) {
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop()?.split('?')[0] : '';

  const everConnected = useRef(false);
  const [showDisconnected, setShowDisconnected] = useState(false);
  useEffect(() => {
    if (isConnected) { everConnected.current = true; setShowDisconnected(false); }
    else if (everConnected.current) setShowDisconnected(true);
  }, [isConnected]);

  const timed = !!timer && !/^-+(:-+)?$/.test(timer);
  const urgent = timed && timeLeft <= 5;
  const pct = timed ? Math.min(100, Math.max(0, (timeLeft / Math.max(1, maxTime)) * 100)) : 0;

  return (
    <div className="mp-arena flex h-[100dvh] flex-col overflow-hidden font-sans text-tx-base">
      {showDisconnected && (
        <div className="fixed left-1/2 top-3 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-2xl border-[3px] border-brand-border bg-accent-secondary px-4 py-2 font-display text-base text-white">
          <WifiOff className="h-5 w-5" /> Connexion perdue, on se reconnecte…
        </div>
      )}

      <header className="shrink-0 px-2 pb-2 pt-[calc(env(safe-area-inset-top)+6px)] sm:px-3">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[18px] border-[3px] border-brand-border bg-brand-card shadow-[0_4px_0_#05061A]">
          <div className="flex items-center gap-1.5 px-1.5 py-1.5 sm:gap-2 sm:px-2">
            {gameId && <GameIcon game={gameId} className="h-9 w-9 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="hidden text-[10px] font-black uppercase leading-none tracking-widest text-accent-success sm:block">Multijoueur</p>
              <p className="text-stroke-sm truncate px-0.5 font-display text-sm leading-tight min-[400px]:text-base sm:text-xl">{gameTitle}</p>
            </div>
            {maxRounds > 0 && (
              <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-1.5 font-display text-sm tabular-nums sm:px-2">
                <span className="hidden text-tx-secondary md:inline">Manche</span>
                {Math.max(1, roundCount)}/{maxRounds}
              </span>
            )}
            {timed && (
              <span className={cn('inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border-[3px] border-brand-border px-2 font-display text-base tabular-nums', urgent ? 'animate-pulse bg-accent-secondary text-white' : 'bg-brand-bg text-white')}>
                <Clock className={cn('h-4 w-4', urgent ? 'text-white' : 'text-accent-success')} />
                {timer}
              </span>
            )}
            <ReactionButton roomId={roomId || ''} />
            {voteToLobby}
          </div>
          <div className="h-1 bg-brand-bg">
            {timed && <div className={cn('h-full transition-[width] duration-300 ease-linear', urgent ? 'bg-accent-secondary' : 'bg-accent-success')} style={{ width: `${pct}%` }} />}
          </div>
        </div>
      </header>

      <main className={cn('relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] sm:px-3', className)}>
        {children}
      </main>
    </div>
  );
}
