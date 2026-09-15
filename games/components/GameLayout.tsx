'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Clock, Users, WifiOff } from 'lucide-react';
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
 * The frame of every multiplayer game. Its own look, next to the solo games':
 * a green-lit arena backdrop and a header that says "Multijoueur", with the
 * game's icon, the round, the clock and the vote to go back to the room.
 */
export default function GameLayout({
  children,
  gameTitle,
  roundCount,
  maxRounds,
  timer,
  timeLeft = 0,
  className,
  voteToLobby,
  isConnected = true,
  maxTime = 30,
  gameId,
}: GameLayoutProps) {
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop()?.split('?')[0] : '';

  // The "connection lost" banner only after a first connection: not during the normal handshake.
  const everConnected = useRef(false);
  const [showDisconnected, setShowDisconnected] = useState(false);
  useEffect(() => {
    if (isConnected) {
      everConnected.current = true;
      setShowDisconnected(false);
    } else if (everConnected.current) {
      setShowDisconnected(true);
    }
  }, [isConnected]);

  const timed = !!timer && !/^-+(:-+)?$/.test(timer);
  const urgent = timed && timeLeft <= 5;
  const pct = timed ? Math.min(100, Math.max(0, (timeLeft / Math.max(1, maxTime)) * 100)) : 0;

  return (
    <div className="mp-arena min-h-[100dvh] text-tx-base font-sans flex flex-col">
      {showDisconnected && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] rounded-2xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-base px-4 py-2 flex items-center justify-center gap-2 shadow-[inset_0_-4px_0_#C92D63,0_4px_0_#05061A]">
          <WifiOff className="w-5 h-5" />
          Connexion perdue, on se reconnecte…
        </div>
      )}

      <div className="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[90]">
        <ReactionButton roomId={roomId || ''} />
      </div>

      <header className="sticky top-0 z-50 px-2 sm:px-3 pt-[calc(env(safe-area-inset-top)+8px)] pb-2 bg-gradient-to-b from-[#0E1030] via-[#0E1030]/90 to-transparent">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[20px] border-4 border-brand-border bg-brand-card shadow-[0_5px_0_#05061A]">
          <div className="flex items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
            {gameId && <GameIcon game={gameId} className="h-10 w-10 shrink-0 sm:h-11 sm:w-11" />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-accent-success sm:text-xs">
                <Users className="h-3.5 w-3.5" /> Multijoueur
              </p>
              <p className="text-stroke-sm truncate px-0.5 font-display text-lg leading-tight sm:text-2xl">{gameTitle}</p>
            </div>
            {maxRounds > 0 && (
              <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 font-display text-sm tabular-nums sm:text-base">
                <span className="hidden text-tx-secondary sm:inline">Manche</span>
                {Math.max(1, roundCount)}/{maxRounds}
              </span>
            )}
            {timed && (
              <span
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border-[3px] border-brand-border px-2 font-display text-base tabular-nums sm:text-lg',
                  urgent ? 'animate-pulse bg-accent-secondary text-white' : 'bg-brand-bg text-white',
                )}
              >
                <Clock className={cn('h-4 w-4', urgent ? 'text-white' : 'text-accent-success')} />
                {timer}
              </span>
            )}
            {voteToLobby}
          </div>
          <div className="h-1.5 bg-brand-bg">
            {timed && (
              <div
                className={cn('h-full transition-[width] duration-300 ease-linear', urgent ? 'bg-accent-secondary' : 'bg-accent-success')}
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>
      </header>

      {/* Bottom room on phones: the reaction button never covers the last button. */}
      <main className={cn('relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4', className)}>
        {children}
      </main>
    </div>
  );
}
