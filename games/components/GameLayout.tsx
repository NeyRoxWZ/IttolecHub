'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Clock, User, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface GameLayoutProps {
  children: ReactNode;
  players: Record<string, number>;
  roundCount: number;
  maxRounds: number;
  timer: string;
  gameCode: string;
  gameTitle: string;
  isHost: boolean;
  gameStarted: boolean;
  onStartGame?: () => void;
  timeLeft: number;
  typingPlayer?: string | null;
}

export default function GameLayout({
  children,
  players,
  roundCount,
  maxRounds,
  timer,
  gameCode,
  gameTitle,
  isHost,
  gameStarted,
  onStartGame,
  timeLeft,
  typingPlayer,
}: GameLayoutProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(gameCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            {gameTitle}
          </h1>
          <div 
            className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={copyCode}
          >
            <span className="text-sm font-mono text-gray-400">#{gameCode}</span>
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-500" />}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {gameStarted && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Manche</span>
              <span className="font-mono font-bold">{roundCount}/{maxRounds}</span>
            </div>
          )}
          
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
            timeLeft <= 5 && gameStarted 
              ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' 
              : 'bg-white/5 border-white/10 text-white'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold min-w-[3ch] text-center">{timer}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 w-full max-w-6xl mx-auto z-10">
        {children}
      </div>

      {/* Footer / Players Bar */}
      <footer className="w-full bg-black/20 backdrop-blur-md border-t border-white/5 p-4 z-10">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
           {typingPlayer && (
             <div className="text-xs text-gray-400 animate-pulse mb-2">
               {typingPlayer} est en train d'écrire...
             </div>
           )}
           
           <div className="flex flex-wrap items-center justify-center gap-4">
            {Object.entries(players)
              .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
              .map(([name, score]) => (
              <div 
                key={name}
                className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-gray-400">{score} pts</span>
                </div>
              </div>
            ))}
            
            {Object.keys(players).length === 0 && (
               <div className="text-sm text-gray-500 italic">En attente de joueurs...</div>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
