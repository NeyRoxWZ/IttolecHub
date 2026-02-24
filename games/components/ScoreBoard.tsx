'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Trophy, User, Home, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Player {
  name: string;
  score: number;
}

interface ScoreBoardProps {
  players: Player[];
  roomCode: string;
  onReplay: () => void;
}

export default function ScoreBoard({ players, roomCode, onReplay }: ScoreBoardProps) {
  const router = useRouter();
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([]);

  useEffect(() => {
    // Trier les joueurs par score décroissant
    const sorted = [...players].sort((a, b) => b.score - a.score);
    setSortedPlayers(sorted);
  }, [players]);

  const handleQuit = () => {
    // Nettoyer la session et retourner à l'accueil
    sessionStorage.removeItem('playerName');
    sessionStorage.removeItem('isHost');
    router.push('/');
  };

  const handleReplay = () => {
    // Retourner à la room pour changer de jeu ou relancer
    onReplay();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Trophy className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Trophy className="h-5 w-5 text-orange-600" />;
      default:
        return <span className="text-lg font-bold text-slate-500">{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-slate-800 dark:text-slate-100';
      case 2:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100';
      case 3:
        return 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-slate-800 dark:text-slate-100';
      default:
        return 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-purple-950 p-4 sm:p-6 game-layout text-slate-800 dark:text-slate-100">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
            Partie terminée !
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Room : {roomCode}
          </p>
        </div>

        <Card className="p-4 sm:p-6 mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center text-slate-800 dark:text-slate-100">
            Classement final
          </h2>
          
          <div className="space-y-3">
            {sortedPlayers.map((player, index) => {
              const rank = index + 1;
              return (
                <div
                  key={player.name}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border-2 ${getRankColor(rank)} transition-all duration-200 hover:scale-[1.02]`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center justify-center w-8 h-8 shrink-0">
                      {getRankIcon(rank)}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-5 w-5 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {player.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {player.score}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                      pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="flex gap-4">
          <Button
            onClick={handleQuit}
            variant="outline"
            className="flex-1 rounded-xl py-3"
          >
            <Home className="h-5 w-5 mr-2" />
            Quitter
          </Button>
          
          <Button
            onClick={handleReplay}
            className="flex-1 rounded-xl py-3 bg-green-600 hover:bg-green-700 text-white"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Rejouer
          </Button>
        </div>
      </div>
    </div>
  );
}