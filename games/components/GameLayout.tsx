'use client';

import { ReactNode, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Clock, User, Copy, Check } from 'lucide-react';

interface GameLayoutProps {
  header?: ReactNode;
  main?: ReactNode;
  footer?: ReactNode;
  playersBar?: ReactNode;
  // Legacy props compatibility (optional)
  children?: ReactNode;
  players?: Record<string, number>;
  roundCount?: number;
  maxRounds?: number;
  timer?: string;
  gameCode?: string;
  gameTitle?: string;
  isHost?: boolean;
  gameStarted?: boolean;
  onStartGame?: () => void;
  timeLeft?: number;
  typingPlayer?: string | null;
}

export default function GameLayout(props: any) {
  // Completely unified layout
  const { 
      children, 
      className,
      // Extracted common props
      roomCode,
      timer,
      round,
      maxRounds,
      players, // array of players
      title,
      onLeave
  } = props;

  // We can render children directly if the game components manage their own full layout,
  // but to ensure consistency we wrap them in a standard container.
  
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen max-w-7xl mx-auto p-4 sm:p-6">
          {children}
      </div>
    </div>
  );
}
