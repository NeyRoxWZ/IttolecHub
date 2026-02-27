'use client';

import { ReactNode } from 'react';
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className
}: GameLayoutProps) {
  
  // Timer progress bar calculation
  // Assuming standard round time is max of what we've seen or 100% if unknown
  // Ideally we should pass maxTime but for now we visualy represent it
  // Let's use a visual trick: if timeLeft is provided, we can animate it
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* HEADER FIXE */}
      <header className="relative z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Game Title & Round */}
            <div className="flex flex-col">
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight leading-none">
                    {gameTitle}
                </h1>
                <span className="text-xs md:text-sm text-slate-400 font-medium">
                    Manche {roundCount}/{maxRounds}
                </span>
            </div>

            {/* Center: Timer (Visual) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-1 w-1/3 max-w-md">
                 <div className="flex items-center gap-2 text-xl font-mono font-bold tabular-nums text-white">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    {timer}
                 </div>
                 {/* Progress Bar */}
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className={cn(
                            "h-full transition-all duration-1000 ease-linear rounded-full",
                            timeLeft < 10 ? "bg-red-500" : "bg-indigo-500"
                        )}
                        style={{ width: `${Math.min(100, (timeLeft / 30) * 100)}%` }} // Fallback base 30s if max unknown
                    />
                 </div>
            </div>

            {/* Right: Timer (Mobile) or Extra Info */}
            <div className="md:hidden flex items-center gap-2 font-mono font-bold text-lg">
                <Clock className="w-4 h-4 text-indigo-400" />
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

      {/* FOOTER / PLAYERS LIST */}
      <footer className="relative z-40 bg-slate-900/80 backdrop-blur-md border-t border-white/10 p-2 md:p-4">
         <div className="max-w-7xl mx-auto">
             <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 custom-scrollbar mask-fade-right">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-400 whitespace-nowrap mr-2">
                    <Users className="w-4 h-4" />
                    Joueurs :
                </div>
                {Object.entries(players).sort((a, b) => b[1] - a[1]).map(([name, score]) => (
                    <div 
                        key={name} 
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 whitespace-nowrap"
                    >
                        <div className="w-2 h-2 rounded-full bg-green-500" /> {/* Online status indicator */}
                        <span className="font-medium text-slate-200">{name}</span>
                        <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 rounded ml-1">
                            {score}
                        </span>
                    </div>
                ))}
             </div>
         </div>
      </footer>
    </div>
  );
}
