'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { CheckCircle, XCircle, Zap, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

interface PokemonData {
  id: number;
  names: { [lang: string]: string };
  imageUrl: string;
  generation: string;
}

interface PlayerAnswer {
  player: string;
  answer: string;
  isCorrect: boolean;
  score: number;
  timeBonus: number;
}

interface PokeGuessrProps {
  roomCode: string | null;
  settings?: { [key: string]: string };
}

export default function PokeGuessr({ roomCode }: PokeGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
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
  } = useGameSync(roomCode ?? '', 'pokeguessr');

  // Realtime
  const { broadcast } = useRealtime(roomCode ?? '', 'pokeguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State from GameState
  const settings = gameState?.settings || {};
  const maxRounds = Number(settings.rounds || 5);
  const roundTime = Number(settings.time || 30);
  const difficulty = settings.difficulty || 'normal';
  const selectedGens = settings.gens || [1];

  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const pokemon: PokemonData | null = gameState?.round_data?.pokemon || null;
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
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  // Helper functions
  const fetchPokemon = async (id: number): Promise<PokemonData | null> => {
    try {
      const res = await fetch(`/api/games/pokemon?id=${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Error fetching pokemon', e);
      return null;
    }
  };

  const getPokemonIdsForGens = async (gens: any, count: number): Promise<number[]> => {
      const genLimits = {
        1: { min: 1, max: 151 },
        2: { min: 152, max: 251 },
        3: { min: 252, max: 386 },
        4: { min: 387, max: 493 },
        5: { min: 494, max: 649 },
        6: { min: 650, max: 721 },
        7: { min: 722, max: 809 },
        8: { min: 810, max: 905 },
        9: { min: 906, max: 1025 },
      };

      let allIds: number[] = [];
      // Handle gens being string "1,2,3" or array [1,2,3]
      const gensArray = Array.isArray(gens) ? gens : (typeof gens === 'string' ? gens.split(',').map(Number) : [1]);
      
      gensArray.forEach((g: number) => {
          const limit = genLimits[g as keyof typeof genLimits];
          if (limit) {
              for (let i = limit.min; i <= limit.max; i++) {
                  allIds.push(i);
              }
          }
      });
      
      for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
      }
      
      return allIds.slice(0, count);
  };

  // Game Logic
  const startRound = async () => {
    if (!isHost || !roomCode) return;
    if (gameState?.round_data?.phase === 'active' && gameState?.round_data?.pokemon) return;

    try {
      const ids = await getPokemonIdsForGens(selectedGens, maxRounds);
      if (ids.length === 0) return;

      const firstId = ids[0];
      const pokemon = await fetchPokemon(firstId);
      const queue = ids.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        phase: 'active',
        pokemon,
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
      
      let nextId;
      let nextQueue = [];

      if (queue.length === 0) {
          const ids = await getPokemonIdsForGens(selectedGens, 1);
          nextId = ids[0];
      } else {
          nextId = queue[0];
          nextQueue = queue.slice(1);
      }

      const pokemon = await fetchPokemon(nextId);
      const endTime = Date.now() + roundTime * 1000;
      
      await nextRound({
         pokemon,
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
    submitAnswer({
        answer: userAnswer.trim(),
        timestamp: Date.now()
    });
    setHasAnswered(true);
    toast.success('Réponse envoyée !');
  };

  const normalize = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  };

  const endRound = async () => {
    if (!isHost || !pokemon || !gameState) return;

    const correctNames = Object.values(pokemon.names).map(n => normalize(n));
    const startTime = gameState.round_data.startTime || (gameState.round_data.endTime - roundTime * 1000);
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    const updates: { playerId: string, score: number }[] = [];

    for (const p of players) {
        const pData = answers[p.id];
        let score = 0;
        let isCorrect = false;
        let timeBonus = 0;
        let answer = '-';
        
        if (pData) {
             answer = pData.answer;
             const timeTaken = (pData.timestamp - startTime) / 1000;
             const normAnswer = normalize(answer);

             if (correctNames.includes(normAnswer)) {
                 isCorrect = true;
                 const midTime = roundTime / 2;
                 if (timeTaken < 5) {
                     score = 1000;
                 } else if (timeTaken < midTime) {
                     score = 700;
                 } else {
                     score = 400;
                 }
             }
        }
        
        results.push({
            player: p.name,
            answer,
            isCorrect,
            score,
            timeBonus
        });

        if (score > 0) {
            updates.push({ playerId: p.id, score: p.score + score });
        }
    }
    
    results.sort((a, b) => b.score - a.score);

    for (const update of updates) {
        await updatePlayerScore(update.playerId, update.score);
    }
    
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing logic
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

  const getImageStyle = () => {
      if (roundEnded) return {};
      switch(difficulty) {
          case 'easy': return { filter: 'blur(10px)' };
          case 'hard': return { filter: 'brightness(0) rotate(180deg)' };
          case 'normal': default: return { filter: 'brightness(0)' };
      }
  };

  return (
    <GameLayout
      gameTitle="PokéGuessr"
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      players={playersMap}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!pokemon ? (
           <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
              <p className="text-xl font-medium animate-pulse">Chargement du Pokémon...</p>
           </div>
        ) : !roundEnded ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 animate-in fade-in duration-500">
             <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center drop-shadow-[0_0_15px_rgba(255,203,5,0.3)]">
                <Image 
                   src={pokemon.imageUrl} 
                   alt="Pokemon" 
                   fill
                   className="object-contain transition-all duration-500"
                   style={getImageStyle()}
                   priority
                />
             </div>
             
             <div className="w-full max-w-md space-y-4">
                <Input 
                    type="text" 
                    placeholder="Quel est ce Pokémon ?" 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="text-center text-xl py-6 bg-slate-800/50 border-yellow-500/20 focus:border-yellow-500 transition-colors"
                    disabled={hasAnswered}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAnswerSubmit();
                    }}
                    autoFocus
                />
                
                <Button 
                    size="lg" 
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg h-14" 
                    onClick={handleAnswerSubmit}
                    disabled={hasAnswered || !userAnswer}
                >
                    {hasAnswered ? 'Réponse envoyée !' : 'Valider'}
                </Button>
             </div>
          </div>
        ) : (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <div className="flex flex-col items-center gap-2 mb-4">
                 <div className="relative w-48 h-48 mb-2 drop-shadow-[0_0_20px_rgba(255,203,5,0.6)]">
                    <Image 
                       src={pokemon.imageUrl} 
                       alt="Pokemon" 
                       fill
                       className="object-contain"
                    />
                 </div>
                 <h2 className="text-4xl font-black text-yellow-400 uppercase tracking-wider">
                    {pokemon.names.fr || Object.values(pokemon.names)[0]}
                 </h2>
              </div>

              <div className="w-full space-y-3">
                 {gameState.round_data.results?.map((res: PlayerAnswer, idx: number) => (
                    <div 
                        key={idx} 
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            idx === 0 ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(255,203,5,0.2)]' : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl w-6 text-slate-400">{idx + 1}.</span>
                            <div className="flex flex-col">
                                <span className="font-bold text-lg">{res.player}</span>
                                <span className="text-sm text-slate-400">
                                    {res.answer} 
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {res.isCorrect ? (
                                <CheckCircle className="text-green-400 w-6 h-6" />
                            ) : (
                                <XCircle className="text-red-400 w-6 h-6" />
                            )}
                            <span className="font-black text-xl text-yellow-400">+{res.score}</span>
                        </div>
                    </div>
                 ))}
              </div>

              {isHost && (
                  <Button size="lg" className="mt-6 w-full max-w-sm bg-indigo-600 hover:bg-indigo-500 h-14 text-lg font-bold" onClick={handleNextRound}>
                      {currentRound < maxRounds ? 'Manche suivante' : 'Terminer la partie'}
                  </Button>
              )}
           </div>
        )}
      </div>
    </GameLayout>
  );
}
