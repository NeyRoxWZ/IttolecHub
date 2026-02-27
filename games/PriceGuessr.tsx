'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap, DollarSign, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface ProductData {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  currency: string;
  description?: string;
}

interface PlayerAnswer {
  playerId: string;
  playerName: string;
  answer: number;
  difference: number;
  score: number;
  timeBonus: number;
}

interface PriceGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function PriceGuessr({ roomCode, settings }: PriceGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(6);
  const [roundTime, setRoundTime] = useState(30);
  const [tolerance, setTolerance] = useState(10); // Percentage
  const [category, setCategory] = useState('all');
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
  } = useGameSync(roomCode ?? '', 'priceguessr');

  // Realtime for transient events (typing)
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'priceguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const productData: ProductData | null = gameState?.round_data?.product || null;
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
          if (gameState.settings.category) setCategory(gameState.settings.category);
      }
  }, [gameState?.settings]);

  // Host updates DB when local state changes
  useEffect(() => {
      if (isHost) {
          const newSettings = { rounds: maxRounds, time: roundTime, tolerance, category };
          // Simple check to avoid infinite loop
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
              updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, tolerance, category, isHost, gameState?.settings, updateSettings]);

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

  const fetchProductsFromApi = async (count: number = 1, cat: string = 'all'): Promise<ProductData[]> => {
    try {
      const res = await fetch(`/api/games/price?count=${count}&category=${cat}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data;
    } catch (e) {
      console.error('Error fetching price data:', e);
      return [];
    }
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      // Fetch enough items for all rounds
      const products = await fetchProductsFromApi(maxRounds, category);
      
      if (products.length === 0) {
        toast.error('Erreur lors du chargement des produits');
        return;
      }

      const currentProduct = products[0];
      const queue = products.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        product: currentProduct,
        queue,
        endTime,
        startTime: Date.now()
      });
      
      setHasAnswered(false);
      setUserAnswer('');
    } catch (e) {
      console.error('Erreur lancement:', e);
      toast.error('Impossible de lancer la partie');
    }
  };

  const handleNextRound = async () => {
    if (!isHost || !gameState?.round_data) return;
    
    try {
      const queue = gameState.round_data.queue || [];
      if (queue.length === 0) {
          // Game Over logic handled by GameLayout usually, or we can set status here
          await setGameStatus('game_over');
          return;
      }

      const currentProduct = queue[0];
      const nextQueue = queue.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         product: currentProduct,
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
    const answer = parseFloat(userAnswer.trim().replace(',', '.'));
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
    if (!isHost || !productData || !gameState) return;

    const exactPrice = productData.price;
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
             diff = Math.abs(answer - exactPrice);
             const percentDiff = (diff / exactPrice) * 100;

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
             diff = exactPrice; // Max diff
             answer = 0;
        }

        results.push({
            playerId: p.id,
            playerName: p.name,
            answer,
            difference: diff,
            score,
            timeBonus
        });

        if (score > 0) {
            updates.push({ playerId: p.id, score: p.score + score });
        }
    }
    
    // Sort by difference (closest first)
    results.sort((a, b) => a.difference - b.difference);

    // Update scores in DB
    for (const update of updates) {
        await updatePlayerScore(update.playerId, update.score);
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
      gameTitle="Price Guessr"
      isHost={isHost}
      gameStarted={gameStarted}
      onStartGame={startRound}
      timeLeft={timeLeft}
      typingPlayer={typingPlayer}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!gameStarted ? (
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-bold">Le Juste Prix</h2>
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
                        <option value="5">±5% (Difficile)</option>
                        <option value="10">±10% (Normal)</option>
                        <option value="20">±20% (Facile)</option>
                      </select>
                   </div>

                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Catégorie</label>
                      <select 
                        value={category} 
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-black/20 border border-white/20 rounded p-2"
                      >
                        <option value="all">Tout</option>
                        <option value="tech">Tech & High-tech</option>
                        <option value="food">Alimentation</option>
                        <option value="fashion">Mode & Vêtements</option>
                        <option value="home">Maison</option>
                        <option value="luxury">Luxe</option>
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
                <div className="flex flex-wrap justify-center gap-2">
                  {players.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-white/10">
                      <User className="w-3 h-3" />
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !roundEnded && productData ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in fade-in duration-500">
             <div className="relative w-64 h-64 bg-white rounded-xl overflow-hidden shadow-2xl p-4 flex items-center justify-center">
                <Image 
                   src={productData.image} 
                   alt={productData.title} 
                   fill 
                   className="object-contain p-4"
                />
             </div>
             
             <div className="text-center">
                <h3 className="text-2xl font-bold mb-2">{productData.title}</h3>
                {productData.description && (
                    <p className="text-sm text-gray-400 max-w-md mx-auto line-clamp-2">{productData.description}</p>
                )}
             </div>

             <div className="w-full max-w-md space-y-4">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <Input 
                        type="number" 
                        placeholder="Prix en dollars..." 
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="pl-8 text-center text-xl py-6"
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
        ) : roundEnded && productData ? (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <h2 className="text-3xl font-bold text-yellow-400">Résultats</h2>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                 <div className="relative w-40 h-40 bg-white rounded-lg overflow-hidden shadow-lg mb-2">
                    <Image 
                       src={productData.image} 
                       alt={productData.title} 
                       fill 
                       className="object-contain p-2"
                    />
                 </div>
                 <h3 className="text-xl font-bold">{productData.title}</h3>
                 <div className="text-4xl font-black text-green-400">
                    ${productData.price}
                 </div>
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                            idx === 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg w-6">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold">{res.playerName}</span>
                                <span className="text-xs text-gray-400">
                                    {res.answer > 0 ? `$${res.answer}` : 'Pas de réponse'} 
                                    (Diff: ${res.difference.toFixed(2)})
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
