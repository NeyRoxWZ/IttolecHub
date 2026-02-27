'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap, Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FoodCalorieProfile {
  label: string;
  min: number;
  max: number;
  exact: number;
  portion: string;
}

interface FoodData {
  category: string;
  image: string;
  profile: FoodCalorieProfile;
}

interface PlayerAnswer {
  player: string;
  answer: number;
  difference: number;
  score: number;
  timeBonus: number;
}

interface CaloriesGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function CaloriesGuessr({ roomCode }: CaloriesGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Sync with DB
  const {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
    startGame,
    submitAnswer,
    nextRound,
    updateRoundData,
    setGameStatus,
    updatePlayerScore
  } = useGameSync(roomCode ?? '', 'caloriesguessr');

  // Realtime for transient events (typing)
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'caloriesguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const settings = gameState?.settings || {};
  const maxRounds = Number(settings.rounds || 5);
  const roundTime = Number(settings.time || 30);
  const tolerance = Number(settings.tolerance || 20);

  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const foodData: FoodData | null = gameState?.round_data?.food || null;
  const currentRound = gameState?.current_round || 0;
  
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [gameState?.round_data?.endTime]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (timeLeft > 0 && !roundEnded) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
             if (isHost && !roundEnded) {
               endRound();
             }
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeLeft, roundEnded, isHost]);

  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }, [timeLeft]);

  const fetchFoodFromApi = async (count: number = 1): Promise<FoodData[]> => {
    try {
      const res = await fetch(`/api/games/calories?count=${count}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Error fetching calories data:', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;
    if (gameState?.round_data?.phase === 'active' && gameState?.round_data?.food) return;

    try {
      const foods = await fetchFoodFromApi(maxRounds);
      
      if (foods.length === 0) {
        toast.error('Erreur API');
        return;
      }

      const currentFood = foods[0];
      const queue = foods.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        phase: 'active',
        food: currentFood,
        queue,
        endTime,
        startTime: Date.now()
      });
      
      setHasAnswered(false);
      setUserAnswer('');
    } catch (e) {
      console.error('Erreur lancement:', e);
    }
  };

  const handleNextRound = async () => {
    if (!isHost || !gameState?.round_data) return;
    
    try {
      const queue = gameState.round_data.queue || [];
      if (queue.length === 0) {
          await setGameStatus('game_over');
          return;
      }

      const currentFood = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         food: currentFood,
         queue: nextQueue,
         endTime,
         startTime: Date.now()
      });
      setHasAnswered(false);
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswerSubmit = () => {
    if (!userAnswer.trim() || roundEnded || hasAnswered) return;
    const answer = parseInt(userAnswer.trim(), 10);
    if (isNaN(answer)) {
        toast.error('Veuillez entrer un nombre valide');
        return;
    }

    submitAnswer({
        answer,
        timestamp: Date.now()
    });
    setHasAnswered(true);
    toast.success('Réponse envoyée !');
  };

  const endRound = async () => {
    if (!isHost || !foodData || !gameState) return;

    const exact = foodData.profile.exact;
    const startTime = gameState.round_data.startTime || (gameState.round_data.endTime - roundTime * 1000);
    
    // Calculate results
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    const updates: { playerId: string, score: number }[] = [];
    
    for (const p of players) {
        const pData = answers[p.id];
        let score = 0;
        let timeBonus = 0;
        let diff = 0;
        let answer = 0;

        if (pData) {
             answer = pData.answer;
             const timeTaken = (pData.timestamp - startTime) / 1000;
             diff = Math.abs(answer - exact);
             const percentDiff = (diff / exact) * 100;

             // Scoring logic
             if (percentDiff <= 5) { // Exact (within minimal tolerance)
                 score = 1000;
             } else if (percentDiff <= tolerance) {
                 score = 600;
             } else if (percentDiff <= tolerance * 2) {
                 score = 300;
             } else {
                 score = 0;
             }

             // Time bonus: +200 if < 5s
             if (timeTaken <= 5 && score > 0) {
                 timeBonus = 200;
                 score += timeBonus;
             }
        } else {
             // Did not answer
             diff = exact; // Max diff
             answer = 0;
        }

        results.push({
            player: p.name,
            answer,
            difference: diff,
            score,
            timeBonus
        });

        if (score > 0) {
            updates.push({ playerId: p.id, score: p.score + score });
        }
    }
    
    results.sort((a, b) => a.difference - b.difference);

    for (const update of updates) {
        await updatePlayerScore(update.playerId, update.score);
    }
    
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing indicator
  useEffect(() => {
    if (!userAnswer) return;
    broadcast({ type: 'typing', data: { player: playerName, isTyping: true } });
    const timeout = setTimeout(() => {
        broadcast({ type: 'typing', data: { player: playerName, isTyping: false } });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [userAnswer, broadcast, playerName]);

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup') {
          startRound();
      }
  }, [isHost, gameState?.round_data?.phase]);

  return (
    <GameLayout
      gameTitle="Calories Guessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!foodData ? (
             <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-orange-400" />
                <p className="text-xl font-medium animate-pulse text-orange-200">Chargement du plat...</p>
             </div>
        ) : !roundEnded ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in fade-in duration-500">
             <div className="relative w-full aspect-video bg-white rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.3)] border border-orange-500/20">
                <Image 
                   src={foodData.image} 
                   alt={foodData.profile.label} 
                   fill 
                   className="object-contain p-4"
                />
             </div>
             
             <div className="text-center">
                <h3 className="text-3xl font-bold mb-2 text-white">{foodData.profile.label}</h3>
                <p className="text-lg text-orange-200 bg-orange-500/10 px-4 py-1 rounded-full inline-block border border-orange-500/20">
                    Pour <span className="font-bold text-white">{foodData.profile.portion}</span>
                </p>
             </div>

             <div className="w-full max-w-md space-y-4">
                <div className="relative">
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-400 font-bold text-lg">kcal</span>
                    <Input 
                        type="number" 
                        placeholder="Combien de calories ?" 
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="text-center text-2xl py-8 font-bold bg-slate-800/50 border-orange-500/30 focus:border-orange-500 rounded-xl transition-all"
                        disabled={hasAnswered}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnswerSubmit();
                        }}
                        autoFocus
                    />
                </div>
                
                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/20 hover:shadow-orange-600/40 rounded-xl transition-all"
                    onClick={handleAnswerSubmit}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="text-center mb-6">
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-2">
                    Résultats
                </h2>
                <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]">
                    {foodData.profile.exact} <span className="text-2xl text-orange-400">kcal</span>
                </div>
              </div>
              
              <div className="relative w-full h-48 bg-white rounded-xl overflow-hidden shadow-lg mb-4 border border-orange-500/20">
                <Image 
                    src={foodData.image} 
                    alt={foodData.profile.label} 
                    fill 
                    className="object-contain p-2"
                />
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            idx === 0 ? 'bg-orange-500/20 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl w-6 text-slate-400">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-white">{res.player}</span>
                                <span className="text-sm text-slate-300">
                                    {res.answer > 0 ? (
                                        <>
                                            <span className="font-mono font-bold text-white">{res.answer}</span> kcal
                                            <span className="text-xs text-slate-400 ml-2">
                                                (Diff: {res.difference > 0 ? '+' : ''}{res.difference.toFixed(0)})
                                            </span>
                                        </>
                                    ) : 'Pas de réponse'} 
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-black text-xl text-orange-400">+{res.score} pts</span>
                            {res.timeBonus > 0 && (
                                <span className="text-xs text-yellow-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                                    <Zap className="w-3 h-3" /> Rapide
                                </span>
                            )}
                        </div>
                    </div>
                 ))}
              </div>

              {isHost && (
                  <Button size="lg" className="mt-6 w-full max-w-sm h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl" onClick={handleNextRound}>
                      {currentRound < maxRounds ? 'Manche suivante' : 'Terminer la partie'}
                  </Button>
              )}
           </div>
        )}
      </div>
    </GameLayout>
  );
}
