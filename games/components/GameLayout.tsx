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
  showScores = true // Default true
}: GameLayoutProps) {
  
  // Extract roomId from URL (simple hack since we don't pass it down yet)
  const roomId = typeof window !== 'undefined' ? window.location.pathname.split('/').pop()?.split('?')[0] : '';

  return (
    <div className="min-h-screen bg-[#0F172A] text-[#F8FAFC] font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#3B82F6]/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#6366F1]/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* REACTION BUTTON (Fixed Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[90]">
          <ReactionButton roomId={roomId || ''} />
      </div>

      {/* HEADER FIXE */}
      <header className="relative z-50 bg-[#1E293B]/80 backdrop-blur-md border-b border-[#334155] px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Game Title & Round */}
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-[#F8FAFC] tracking-tight leading-none">
                    {gameTitle}
                </h1>
                <span className="text-xs md:text-sm text-[#94A3B8] font-medium">
                    Manche {roundCount}/{maxRounds}
                </span>
            </div>

            {/* Center: Timer (Visual) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-1 w-1/3 max-w-md">
                 <div className="flex items-center gap-2 text-xl font-mono font-bold tabular-nums text-[#F8FAFC]">
                    <Clock className="w-5 h-5 text-[#3B82F6]" />
                    {timer}
                 </div>
                 {/* Progress Bar */}
                 <div className="w-full h-1.5 bg-[#334155] rounded-full overflow-hidden">
                    <div 
                        className={cn(
                            "h-full transition-all duration-1000 ease-linear rounded-full",
                            timeLeft < 10 ? "bg-red-500" : "bg-[#3B82F6]"
                        )}
                        style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }} // Fallback base 30s if max unknown
                    />
                 </div>
            </div>

            {/* Right: Timer (Mobile) or Extra Info */}
            <div className="md:hidden flex items-center gap-2 font-mono font-bold text-lg">
                <Clock className="w-4 h-4 text-[#3B82F6]" />
                {timer}
            </div>
        </div>
      </header>

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
