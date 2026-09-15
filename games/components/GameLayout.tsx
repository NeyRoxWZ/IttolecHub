'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactionButton from './ReactionButton';

interface GameLayoutProps {
  children: ReactNode;
  // Game Info
  gameTitle: string;
  roundCount: number;
  maxRounds: number;
  timer: string;
  // State
  timeLeft?: number;
  className?: string;
  voteToLobby?: ReactNode; // Vote to lobby button
  isConnected?: boolean; // Realtime connection status (from useGameSync)
  maxTime?: number; // Length of the current phase in seconds, for the progress bar
}

export default function GameLayout({
  children,
  gameTitle,
  roundCount,
  maxRounds,
  timer,
  timeLeft = 0,
  className,
  voteToLobby, // Default undefined
  isConnected = true,
  maxTime = 30
}: GameLayoutProps) {

  // Extract roomId from URL (simple hack since we don't pass it down yet)
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop()?.split('?')[0] : '';

  // Only show the "connection lost" banner after we've connected at least
  // once — otherwise it'd flash during the normal initial handshake.
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

  const urgent = timeLeft < 10;

  return (
    <div className="min-h-screen bg-transparent text-tx-base font-sans selection:bg-accent-primary/30 flex flex-col">
      {showDisconnected && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] rounded-2xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-base px-4 py-2 flex items-center justify-center gap-2 shadow-[inset_0_-4px_0_#C92D63,0_4px_0_#05061A] animate-in slide-in-from-top duration-300">
          <WifiOff className="w-5 h-5" />
          Connexion perdue, on se reconnecte…
        </div>
      )}

      {/* REACTION BUTTON (Fixed Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[90]">
          <ReactionButton roomId={roomId || ''} />
      </div>

      {/* HEADER */}
      <header className="relative z-50 px-3 pt-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 rounded-[22px] border-4 border-brand-border bg-brand-card px-3 py-2.5 shadow-[inset_0_-5px_0_#151942,0_5px_0_#05061A]">
            {/* Left: Game Title & Round */}
            <div className="flex items-center gap-3 min-w-0">
                <h1 className="text-xl md:text-3xl font-display text-tx-base leading-none truncate">
                    {gameTitle}
                </h1>
                <span className="shrink-0 inline-flex items-center h-8 rounded-xl border-[3px] border-brand-border bg-accent-info text-white font-display text-sm md:text-base px-2.5 shadow-[inset_0_-3px_0_#2F5BD0]">
                    Manche {roundCount}/{maxRounds}
                </span>
            </div>

            {/* Center: Timer (Visual) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-1.5 hidden md:flex items-center gap-3 w-1/3 max-w-sm">
                 <div className={cn(
                   'shrink-0 inline-flex items-center gap-1.5 h-10 rounded-xl border-[3px] border-brand-border px-3 font-display text-2xl tabular-nums',
                   urgent ? 'bg-accent-secondary text-white animate-pulse' : 'bg-brand-bg text-white'
                 )}>
                    <Clock className={cn('w-5 h-5', urgent ? 'text-white' : 'text-accent-primary')} />
                    {timer}
                 </div>
                 {/* Progress Bar */}
                 <div className="flex-1 h-4 bg-brand-bg border-[3px] border-brand-border rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-1000 ease-linear shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]",
                            urgent ? "bg-accent-secondary" : "bg-accent-primary"
                        )}
                        style={{ width: `${Math.min(100, (timeLeft / Math.max(1, maxTime)) * 100)}%` }}
                    />
                 </div>
            </div>

            {/* Right: Timer (Mobile) or Extra Info */}
            <div className="flex items-center gap-3 shrink-0">
              <div className={cn(
                'md:hidden inline-flex items-center gap-1.5 h-10 rounded-xl border-[3px] border-brand-border px-2.5 font-display text-xl tabular-nums',
                urgent ? 'bg-accent-secondary text-white' : 'bg-brand-bg text-white'
              )}>
                  <Clock className={cn('w-4 h-4', urgent ? 'text-white' : 'text-accent-primary')} />
                  {timer}
              </div>
              {/* Vote to Lobby button - desktop only in header */}
              <div className="hidden md:block">
                {voteToLobby}
              </div>
            </div>
        </div>
      </header>

      {/* Mobile floating vote button - rendered outside header */}
      <div className="md:hidden">
        {voteToLobby}
      </div>

      {/* MAIN CONTENT AREA */}
      <main className={cn(
          "relative z-10 flex-1 flex flex-col items-center justify-center p-4 w-full max-w-7xl mx-auto",
          className
      )}>
          {children}
      </main>
    </div>
  );
}
