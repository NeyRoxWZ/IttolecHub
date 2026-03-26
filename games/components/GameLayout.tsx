'use client';

import { ReactNode } from 'react';
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactionButton from './ReactionButton';

interface GameLayoutProps {
  children: ReactNode;
  // Game Info
  gameTitle: string;
  roundCount: number;
  maxRounds: number;
  timer: string;
  // Players
  players: Record<string, number>; // name -> score
  // State
  timeLeft?: number;
  gameStarted?: boolean;
  className?: string;
  showScores?: boolean; // New prop to toggle score display
  voteToLobby?: ReactNode; // Vote to lobby button
}

export default function GameLayout({
  children,
  gameTitle,
  roundCount,
  maxRounds,
  timer,
  players,
  timeLeft = 0,
  gameStarted = true,
  className,
  showScores = true, // Default true
  voteToLobby // Default undefined
}: GameLayoutProps) {
  
  // Extract roomId from URL (simple hack since we don't pass it down yet)
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop()?.split('?')[0] : '';

  return (
    <div className="min-h-screen bg-transparent text-tx-base font-sans selection:bg-accent-primary/30 flex flex-col">
      {/* REACTION BUTTON (Fixed Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[90]">
          <ReactionButton roomId={roomId || ''} />
      </div>

      {/* HEADER FIXED */}
      <header className="relative z-50 bg-brand-card/90 backdrop-blur-md border-b-4 border-brand-border px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Game Title & Round */}
            <div className="flex flex-col">
                <h1 className="text-lg md:text-2xl font-display font-black text-tx-base tracking-tight leading-none uppercase">
                    {gameTitle}
                </h1>
                <span className="text-xs md:text-sm text-tx-secondary font-bold uppercase tracking-widest mt-1">
                    Manche {roundCount}/{maxRounds}
                </span>
            </div>

            {/* Center: Timer (Visual) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-1.5 w-1/3 max-w-md">
                 <div className="flex items-center gap-2 text-2xl font-display font-black tabular-nums text-tx-base">
                    <Clock className="w-6 h-6 text-accent-primary" />
                    {timer}
                 </div>
                 {/* Progress Bar */}
                 <div className="w-full h-3 bg-brand-inner border-2 border-brand-border rounded-full overflow-hidden">
                    <div 
                        className={cn(
                            "h-full transition-all duration-1000 ease-linear",
                            timeLeft < 10 ? "bg-accent-secondary" : "bg-accent-primary"
                        )}
                        style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }} // Fallback base 30s if max unknown
                    />
                 </div>
            </div>

            {/* Right: Timer (Mobile) or Extra Info */}
            <div className="flex items-center gap-4">
              <div className="md:hidden flex items-center gap-2 font-display font-black text-xl bg-brand-inner px-3 py-1 rounded-xl border-2 border-brand-border">
                  <Clock className="w-5 h-5 text-accent-primary" />
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
