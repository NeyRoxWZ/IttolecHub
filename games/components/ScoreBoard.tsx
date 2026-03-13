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
        return <span className="text-lg font-bold text-[#94A3B8]">{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-[#1E293B] border-yellow-500/50 text-[#F8FAFC]';
      case 2:
        return 'bg-[#1E293B] border-gray-500/50 text-[#F8FAFC]';
      case 3:
        return 'bg-[#1E293B] border-orange-500/50 text-[#F8FAFC]';
      default:
        return 'bg-[#1E293B] border-[#334155] text-[#F8FAFC]';
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] p-4 sm:p-6 game-layout text-[#F8FAFC]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-[#3B82F6] mb-2">
            Partie terminée !
          </h1>
          <p className="text-[#94A3B8]">
            Room : {roomCode}
          </p>
        </div>

        <Card className="p-4 sm:p-6 mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center text-[#F8FAFC]">
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
                      <User className="h-5 w-5 text-[#94A3B8] shrink-0" />
                      <span className="font-semibold text-[#F8FAFC] truncate">
                        {player.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-[#3B82F6]">
                      {player.score}
                    </span>
                    <span className="text-sm text-[#94A3B8] ml-1">
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
            variant="primary"
            className="flex-1 rounded-xl py-3"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            Rejouer
          </Button>
        </div>
      </div>
    </div>
  );
}
