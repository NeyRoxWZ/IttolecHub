'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Check, Clock, User, Zap, DollarSign, ShoppingBag, Loader2, Trophy, Home, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

export default function PriceGuessr({ roomCode }: PriceGuessrProps) {
  const router = useRouter();
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
  } = useGameSync(roomCode ?? '', 'priceguessr');

  // Realtime for transient events (typing)
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'priceguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const settings = gameState?.settings || {};
  const maxRounds = Number(settings.rounds || 6);
  const roundTime = Number(settings.time || 30);
  const tolerance = Number(settings.tolerance || 10);
  const category = settings.category || 'all';

  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const productData: ProductData | null = gameState?.round_data?.product || null;
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

  if (gameState?.status === 'game_over') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    return (
        <GameLayout
            gameTitle="Le Juste Prix"
            roundCount={currentRound}
            maxRounds={maxRounds}
            timer="Terminé"
            players={playersMap}
            timeLeft={0}
            gameStarted={true}
        >
            <div className="flex flex-col items-center gap-8 w-full max-w-2xl mx-auto animate-in zoom-in duration-500">
                <Trophy className="w-24 h-24 text-amber-400 animate-bounce" />
                <h2 className="text-4xl font-bold text-white">Fin de la partie !</h2>
                
                <div className="w-full bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 border-b border-white/5 last:border-0 ${i === 0 ? 'bg-amber-500/20' : ''}`}>
                            <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                                    i === 0 ? 'bg-amber-500 text-black' : 
                                    i === 1 ? 'bg-slate-300 text-black' : 
                                    i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                                }`}>
                                    {i + 1}
                                </span>
                                <span className="font-bold text-lg">{p.name}</span>
                            </div>
                            <span className="font-mono text-xl font-bold text-amber-400">{p.score} pts</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 w-full">
                    <Button variant="outline" className="flex-1 h-14" onClick={() => router.push(`/room/${roomCode}`)}>
                        <Home className="w-5 h-5 mr-2" /> Retour au lobby
                    </Button>
                    <Button className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white" onClick={() => router.push('/')}>
                        <LogOut className="w-5 h-5 mr-2" /> Quitter
                    </Button>
                </div>
            </div>
        </GameLayout>
    );
  }

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
    if (gameState?.round_data?.phase === 'active' && gameState?.round_data?.product) return;

    try {
      const products = await fetchProductsFromApi(maxRounds, category);
      
      if (products.length === 0) {
        toast.error('Erreur lors du chargement des produits');
        return;
      }

      const currentProduct = products[0];
      const queue = products.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        phase: 'active',
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

    if (answer < 0) {
        toast.error('Le prix ne peut pas être négatif !');
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

  // Auto-start
  useEffect(() => {
      if (isHost && gameState?.round_data?.phase === 'setup') {
          startRound();
      }
  }, [isHost, gameState?.round_data?.phase]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameTitle="Le Juste Prix"
      gameStarted={gameStarted}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!productData ? (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-amber-400" />
                <p className="text-xl font-medium animate-pulse text-amber-200">Chargement du produit...</p>
            </div>
        ) : !roundEnded ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in fade-in duration-500">
             <div className="relative w-full aspect-square max-w-sm bg-white rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.3)] border border-amber-500/20 p-4 flex items-center justify-center">
                <Image 
                   src={productData.image} 
                   alt={productData.title} 
                   fill 
                   className="object-contain p-4"
                />
             </div>
             
             <div className="text-center">
                <h3 className="text-2xl font-bold mb-2 text-white">{productData.title}</h3>
                {productData.description && (
                    <p className="text-sm text-gray-400 max-w-md mx-auto line-clamp-2">{productData.description}</p>
                )}
             </div>

             <div className="w-full max-w-md space-y-4">
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 font-bold text-xl">$</span>
                    <Input 
                        type="number" 
                        min="0"
                        placeholder="Prix en dollars..." 
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        className="pl-8 text-center text-2xl py-8 font-bold bg-slate-800/50 border-amber-500/30 focus:border-amber-500 rounded-xl transition-all"
                        disabled={hasAnswered}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnswerSubmit();
                        }}
                        autoFocus
                    />
                </div>
                
                <Button 
                    size="lg" 
                    className="w-full h-14 text-lg font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20 hover:shadow-amber-600/40 rounded-xl transition-all"
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
                <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-600 mb-2">
                    Résultats
                </h2>
                <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                    ${productData.price}
                </div>
              </div>
              
              <div className="relative w-40 h-40 bg-white rounded-xl overflow-hidden shadow-lg mb-4 border border-amber-500/20">
                <Image 
                   src={productData.image} 
                   alt={productData.title} 
                   fill 
                   className="object-contain p-2"
                />
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            idx === 0 ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl w-6 text-slate-400">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-white">{res.playerName}</span>
                                <span className="text-sm text-slate-300">
                                    {res.answer > 0 ? (
                                        <>
                                            <span className="font-mono font-bold text-white">${res.answer}</span>
                                            <span className="text-xs text-slate-400 ml-2">
                                                (Diff: {res.difference > 0 ? '+' : ''}{res.difference.toFixed(2)})
                                            </span>
                                        </>
                                    ) : 'Pas de réponse'} 
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="font-black text-xl text-amber-400">+{res.score} pts</span>
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
