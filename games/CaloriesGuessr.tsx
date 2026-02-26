'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap } from 'lucide-react';

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
}

interface CaloriesGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

const FOOD_CALORIES: Record<string, FoodCalorieProfile> = {
  burger: { label: 'Burger', min: 400, max: 900, exact: 650, portion: '1 burger moyen' },
  pizza: { label: 'Pizza', min: 500, max: 1100, exact: 800, portion: '2 parts de pizza' },
  pasta: { label: 'Pâtes', min: 350, max: 900, exact: 600, portion: '1 assiette de 250g' },
  biryani: { label: 'Biryani', min: 500, max: 1100, exact: 800, portion: '1 assiette' },
  dessert: { label: 'Dessert', min: 250, max: 900, exact: 550, portion: '1 portion' },
  dosa: { label: 'Dosa', min: 250, max: 600, exact: 400, portion: '1 dosa' },
  idly: { label: 'Idly', min: 100, max: 350, exact: 220, portion: '2 idlis' },
  rice: { label: 'Riz', min: 150, max: 500, exact: 320, portion: '1 bol (180g)' },
  sandwich: { label: 'Sandwich', min: 300, max: 800, exact: 550, portion: '1 sandwich' },
  steak: { label: 'Steak', min: 400, max: 900, exact: 650, portion: '1 steak + accompagnement' },
  generic: { label: 'Plat', min: 200, max: 900, exact: 550, portion: '1 portion' },
};

export default function CaloriesGuessr({ roomCode, settings }: CaloriesGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);

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
    // If host and settings provided via props (URL), update DB
    if (isHost && settings && Object.keys(settings).length > 0) {
      updateSettings(settings);
    }
  }, [isHost, settings]);

  useEffect(() => {
    // If client, sync local settings from DB
    if (gameState?.settings) {
      if (gameState.settings.rounds) setMaxRounds(parseInt(gameState.settings.rounds, 10));
      if (gameState.settings.time) setRoundTime(parseInt(gameState.settings.time, 10));
    }
  }, [gameState?.settings]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    } else if (gameStarted && !roundEnded) {
       // Fallback or initial set
       // If just started, maybe we don't have endTime yet?
    }
  }, [gameState?.round_data?.endTime, gameStarted, roundEnded]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (gameStarted && !roundEnded && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
             // Timer finished
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
      const page = Math.floor(Math.random() * 20) + 1;
      const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?action=process&sort_by=unique_scans_n&page_size=${count * 2}&page=${page}&json=1`);
      const data = await res.json();
      
      const products = data.products
        .filter((p: any) => p.image_front_url && p.nutriments?.['energy-kcal_100g'] && p.product_name)
        .map((p: any) => ({
          category: 'generic',
          image: p.image_front_url,
          profile: {
            label: p.product_name,
            min: 0,
            max: 1000, // Not used for validation
            exact: Math.round(p.nutriments['energy-kcal_100g']),
            portion: '100g'
          }
        }))
        .slice(0, count);

      return products;
    } catch (e) {
      console.error('Error fetching OpenFoodFacts:', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      // Fetch enough items for all rounds
      const foods = await fetchFoodFromApi(maxRounds);
      
      if (foods.length === 0) return; // Handle error

      const currentFood = foods[0];
      const queue = foods.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        food: currentFood,
        queue,
        endTime
      });
      
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
          // Should not happen if we fetched enough, but maybe fetch more?
          // Or just end game?
          // For now, fetch one more
          const newFoods = await fetchFoodFromApi(1);
          if (newFoods.length > 0) {
              const currentFood = newFoods[0];
              const endTime = Date.now() + roundTime * 1000;
              await nextRound({ food: currentFood, queue: [], endTime });
          }
          return;
      }

      const currentFood = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         food: currentFood,
         queue: nextQueue,
         endTime
      });
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    const answer = parseInt(userAnswer.trim(), 10);
    if (Number.isNaN(answer)) return;

    submitAnswer(answer);
  };

  const endRound = async () => {
    if (!isHost || !foodData || !gameState) return;

    const exact = foodData.profile.exact;
    
    // Calculate results
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    // Include host if not in answers (host might not play or play differently)
    // Actually host is just a player here.
    
    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        if (pAnswer !== undefined) {
             results.push({
                 player: p.name,
                 answer: pAnswer,
                 difference: Math.abs(pAnswer - exact)
             });
        } else {
             // Did not answer
             results.push({
                 player: p.name,
                 answer: 0,
                 difference: 9999 // Penalty? Or just ignore.
             });
        }
    }
    
    // Sort by difference
    results.sort((a, b) => a.difference - b.difference);

    // Update scores
    // Winner gets 10 points
    if (results[0] && results[0].difference < 9999) {
       const winnerName = results[0].player;
       const winner = players.find(p => p.name === winnerName);
       if (winner) {
           await updatePlayerScore(winner.id, winner.score + 10);
       }
    }
    
    // Update round data with results
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing indicator
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    if (lastMessage.type === 'typing') {
         if (lastMessage.data.player !== playerName && lastMessage.data.isTyping) {
          setTypingPlayer(lastMessage.data.player);
        } else if (lastMessage.data.player !== playerName && !lastMessage.data.isTyping) {
          setTypingPlayer((current) =>
            current === lastMessage.data.player ? null : current,
          );
        }
    }
  }, [messages, playerName]);
  
  // Clean up typing
  useEffect(() => {
    if (!typingPlayer) return;
    const timeout = setTimeout(() => setTypingPlayer(null), 3000);
    return () => clearTimeout(timeout);
  }, [typingPlayer]);
  
  // Calculate player answers for UI
  const playerAnswers = useMemo(() => {
      if (gameState?.round_data?.results) {
          return gameState.round_data.results as PlayerAnswer[];
      }
      return [];
  }, [gameState?.round_data?.results]);
  
  // Answered players
  const answeredPlayers = useMemo(() => {
      if (gameState?.answers) {
          return Object.keys(gameState.answers).map(pid => {
              const p = players.find(pl => pl.id === pid);
              return p ? p.name : 'Unknown';
          });
      }
      return [];
  }, [gameState?.answers, players]);

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
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">En attente du lancement...</h2>
            {isHost ? (
              <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm">
                <p className="mb-4">
                  Vous êtes l'hôte. Configurez la partie et lancez quand tout le
                  monde est prêt !
                </p>
                <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mb-6">
                   {/* Settings UI could go here, but for now relying on URL params */}
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <span className="font-bold">{maxRounds}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="w-3 h-3" /> Temps
                      </span>
                      <span className="font-bold">{roundTime}s</span>
                   </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-white/10"
                    >
                      <User className="w-3 h-3" />
                      {p.name}
                    </div>
                  ))}
                </div>

                <Button size="lg" onClick={startRound}>
                  Lancer la partie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p>L'hôte va bientôt lancer la partie...</p>

                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-white/10"
                    >
                      <User className="w-3 h-3" />
                      {p.name}
                    </div>
                  ))}
                </div>

                 <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mt-4 opacity-75">
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <span className="font-bold">{maxRounds}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="flex items-center gap-1 text-sm text-gray-400">
                        <Clock className="w-3 h-3" /> Temps
                      </span>
                      <span className="font-bold">{roundTime}s</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {foodData && (
              <div className="relative w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-2xl group">
                <Image
                  src={foodData.image}
                  alt="Food"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-orange-500 rounded-full text-xs font-bold uppercase tracking-wider">
                      {foodData.profile.label}
                    </span>
                    <span className="text-sm opacity-80">
                      {foodData.profile.portion}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Entrez le nombre de calories..."
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-14 text-lg pr-12 text-center font-mono"
                    autoFocus
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-gray-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all"
                  onClick={handleAnswer}
                >
                  Valider ma réponse
                </Button>
                
                {/* Answered Players Indicator */}
                {answeredPlayers.length > 0 && (
                   <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {answeredPlayers.map(p => (
                         <div key={p} className="flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
                           <Check className="w-3 h-3" /> {p}
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-white/5 rounded-2xl p-8 backdrop-blur-sm border border-white/10 animate-in zoom-in-95 duration-300">
                <div className="text-center mb-8">
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
                    Résultats
                  </h3>
                  <div className="text-6xl font-black text-white mb-2">
                    {foodData?.profile.exact}
                    <span className="text-2xl font-normal text-gray-400 ml-2">
                      kcal
                    </span>
                  </div>
                  <p className="text-gray-400">La bonne réponse était {foodData?.profile.exact} kcal</p>
                </div>

                <div className="space-y-3 mb-8">
                  {playerAnswers.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        i === 0
                          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30'
                          : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                            i === 0
                              ? 'bg-yellow-500 text-black'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span className="font-medium text-lg">{p.player}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xl">
                          {p.answer}
                        </div>
                        <div className="text-xs text-gray-400">
                          {p.difference === 0 ? 'Exact !' : `Diff: ${p.difference}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isHost && (
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200"
                    onClick={handleNextRound}
                  >
                    Manche suivante
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </GameLayout>
  );
}
