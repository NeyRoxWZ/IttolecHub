'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap, Flame } from 'lucide-react';
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

export default function CaloriesGuessr({ roomCode, settings }: CaloriesGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(30);
  const [tolerance, setTolerance] = useState(20); // Percentage
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Sync with DB
  const {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
    updateSettings,
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
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const foodData: FoodData | null = gameState?.round_data?.food || null;
  const currentRound = gameState?.current_round || 0;
  
  // Transform players array to Record<name, score> for UI compatibility
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync settings
  useEffect(() => {
      if (gameState?.settings) {
          if (gameState.settings.rounds) setMaxRounds(Number(gameState.settings.rounds));
          if (gameState.settings.time) setRoundTime(Number(gameState.settings.time));
          if (gameState.settings.tolerance) setTolerance(Number(gameState.settings.tolerance));
      }
  }, [gameState?.settings]);

  // Host updates DB when local state changes
  useEffect(() => {
      if (isHost) {
          const newSettings = { rounds: maxRounds, time: roundTime, tolerance };
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
              updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, tolerance, isHost, gameState?.settings, updateSettings]);

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
    if (gameStarted && !roundEnded && timeLeft > 0) {
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
  }, [gameStarted, roundEnded, timeLeft, isHost]);

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

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameCode={roomCode ?? ''}
      gameTitle="Calories Guessr"
      isHost={isHost}
      gameStarted={gameStarted}
      onStartGame={startRound}
      timeLeft={timeLeft}
      typingPlayer={typingPlayer}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!gameStarted ? (
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-bold">Calories Guessr</h2>
            {isHost ? (
              <div className="p-6 bg-white/10 rounded-lg backdrop-blur-sm space-y-4">
                <p className="mb-4">Configurez la partie :</p>
                
                <div className="space-y-4 text-left">
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Nombre de manches ({maxRounds})</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="15" 
                        value={maxRounds} 
                        onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Temps par manche ({roundTime}s)</label>
                      <input 
                        type="range" 
                        min="15" 
                        max="60" 
                        value={roundTime} 
                        onChange={(e) => setRoundTime(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>

                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Tolérance ({tolerance}%)</label>
                      <select 
                        value={tolerance} 
                        onChange={(e) => setTolerance(parseInt(e.target.value))}
                        className="w-full bg-black/20 border border-white/20 rounded p-2"
                      >
                        <option value="10">±10% (Difficile)</option>
                        <option value="20">±20% (Normal)</option>
                        <option value="30">±30% (Facile)</option>
                      </select>
                   </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-white/10">
                      <User className="w-3 h-3" />
                      {p.name}
                    </div>
                  ))}
                </div>

                <Button size="lg" className="w-full mt-4" onClick={startRound}>
                  Lancer la partie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p>En attente de l'hôte...</p>
              </div>
            )}
          </div>
        ) : !roundEnded && foodData ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in fade-in duration-500">
             <div className="relative w-64 h-64 bg-white rounded-xl overflow-hidden shadow-2xl p-4 flex items-center justify-center">
                <Image 
                   src={foodData.image} 
                   alt={foodData.profile.label} 
                   fill 
                   className="object-contain"
                />
             </div>
             
             <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">{foodData.profile.label}</h3>
                <p className="text-sm text-gray-400">Pour {foodData.profile.portion}</p>
             </div>

             <div className="w-full max-w-md space-y-4">
                <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">kcal</span>
                    <Input 
                        type="number" 
                        placeholder="Calories ?" 
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="text-center text-xl py-6"
                        disabled={hasAnswered}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnswerSubmit();
                        }}
                    />
                </div>
                
                <Button 
                    size="lg" 
                    className="w-full" 
                    onClick={handleAnswerSubmit}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : roundEnded && foodData ? (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <h2 className="text-3xl font-bold text-orange-400">Résultats</h2>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                 <div className="relative w-40 h-40 bg-white rounded-lg overflow-hidden shadow-lg mb-2">
                    <Image 
                       src={foodData.image} 
                       alt={foodData.profile.label} 
                       fill 
                       className="object-contain"
                    />
                 </div>
                 <h3 className="text-xl font-bold">{foodData.profile.label}</h3>
                 <div className="text-4xl font-black text-green-400">
                    {foodData.profile.exact} kcal
                 </div>
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                            idx === 0 ? 'bg-orange-500/20 border-orange-500' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg w-6">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold">{res.player}</span>
                                <span className="text-xs text-gray-400">
                                    {res.answer > 0 ? `${res.answer} kcal` : 'Pas de réponse'} 
                                    (Diff: {res.difference.toFixed(0)})
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-bold text-xl">+{res.score} pts</span>
                            {res.timeBonus > 0 && (
                                <span className="text-xs text-yellow-400 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Rapide
                                </span>
                            )}
                        </div>
                    </div>
                 ))}
              </div>

              {isHost && (
                  <Button size="lg" className="mt-6" onClick={handleNextRound}>
                      {currentRound < maxRounds ? 'Manche suivante' : 'Terminer la partie'}
                  </Button>
              )}
           </div>
        ) : null}
      </div>
    </GameLayout>
  );
}
