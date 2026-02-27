'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRealtime } from '@/hooks/useRealtime';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, XCircle, Zap, Check } from 'lucide-react';
import Image from 'next/image';

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

export default function PokeGuessr({ roomCode, settings }: PokeGuessrProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [maxRounds, setMaxRounds] = useState(5);
  const [roundTime, setRoundTime] = useState(30);
  const [typingPlayer, setTypingPlayer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  
  // Settings
  const [selectedGens, setSelectedGens] = useState<number[]>([1]);
  const [difficulty, setDifficulty] = useState<string>('normal');

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
  } = useGameSync(roomCode ?? '', 'pokeguessr');

  // Realtime
  const { broadcast, messages } = useRealtime(roomCode ?? '', 'pokeguessr');

  const playerName =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('playerName') || 'Anonyme'
      : 'Anonyme';

  // Derived State
  const gameStarted = roomStatus === 'in_game';
  const roundEnded = gameState?.status === 'round_results' || gameState?.status === 'game_over';
  const pokemon: PokemonData | null = gameState?.round_data?.pokemon || null;
  const currentRound = gameState?.current_round || 0;
  
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => ({ ...acc, [p.name]: p.score }), {} as Record<string, number>);
  }, [players]);

  // Sync settings
  useEffect(() => {
    if (gameState?.settings) {
      if (gameState.settings.rounds) setMaxRounds(Number(gameState.settings.rounds));
      if (gameState.settings.time) setRoundTime(Number(gameState.settings.time));
      if (gameState.settings.difficulty) setDifficulty(gameState.settings.difficulty);
      if (gameState.settings.gens && Array.isArray(gameState.settings.gens)) {
          if (JSON.stringify(gameState.settings.gens) !== JSON.stringify(selectedGens)) {
               setSelectedGens(gameState.settings.gens);
          }
      }
    }
  }, [gameState?.settings]);

  // Host updates DB when local state changes
  useEffect(() => {
      if (isHost) {
          const newSettings = { 
              rounds: maxRounds, 
              time: roundTime, 
              gens: selectedGens,
              difficulty
          };
          
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
               updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, selectedGens, difficulty, isHost, gameState?.settings, updateSettings]);

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
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

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

  const getPokemonIdsForGens = async (gens: number[], count: number): Promise<number[]> => {
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
      const safeGens = (!gens || gens.length === 0) ? [1] : gens;
      
      safeGens.forEach(g => {
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

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      const ids = await getPokemonIdsForGens(selectedGens, maxRounds);
      if (ids.length === 0) return;

      const firstId = ids[0];
      const pokemon = await fetchPokemon(firstId);
      const queue = ids.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
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
                 
                 // Scoring: <5s -> 1000, <mid -> 700, >mid -> 400
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

  const getImageStyle = () => {
      if (roundEnded) return {};
      
      switch(difficulty) {
          case 'easy':
              return { filter: 'blur(10px)' };
          case 'hard':
              return { filter: 'brightness(0) rotate(180deg)' };
          case 'normal':
          default:
              return { filter: 'brightness(0)' };
      }
  };

  return (
    <GameLayout
      players={playersMap}
      roundCount={currentRound}
      maxRounds={maxRounds}
      timer={formattedTimer}
      gameCode={roomCode ?? ''}
      gameTitle="PokéGuessr"
      isHost={isHost}
      gameStarted={gameStarted}
      onStartGame={startRound}
      timeLeft={timeLeft}
      typingPlayer={typingPlayer}
    >
      <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto gap-8">
        {!gameStarted ? (
          <div className="text-center space-y-6 w-full max-w-md">
            <h2 className="text-2xl font-bold">PokéGuessr</h2>
            {isHost ? (
              <div className="p-6 bg-white/10 rounded-lg backdrop-blur-sm space-y-4">
                <p className="mb-4">Configurez la partie :</p>
                
                <div className="space-y-4 text-left">
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Nombre de manches ({maxRounds})</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={maxRounds} 
                        onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Temps par manche ({roundTime}s)</label>
                      <input 
                        type="range" 
                        min="10" 
                        max="60" 
                        value={roundTime} 
                        onChange={(e) => setRoundTime(parseInt(e.target.value))}
                        className="w-full"
                      />
                   </div>

                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Difficulté</label>
                      <select 
                        value={difficulty} 
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="w-full bg-black/20 border border-white/20 rounded p-2"
                      >
                        <option value="easy">Facile (Flou)</option>
                        <option value="normal">Normal (Silhouette)</option>
                        <option value="hard">Difficile (Renversé)</option>
                      </select>
                   </div>
                   
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Générations</label>
                      <div className="flex flex-wrap gap-2">
                          {[1,2,3,4,5,6,7,8,9].map(g => (
                              <button 
                                key={g}
                                onClick={() => {
                                    if (selectedGens.includes(g)) {
                                        if (selectedGens.length > 1) setSelectedGens(selectedGens.filter(x => x !== g));
                                    } else {
                                        setSelectedGens([...selectedGens, g]);
                                    }
                                }}
                                className={`px-2 py-1 rounded text-xs border ${selectedGens.includes(g) ? 'bg-white text-black border-white' : 'bg-transparent border-white/40'}`}
                              >
                                  Gen {g}
                              </button>
                          ))}
                      </div>
                   </div>
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
        ) : !roundEnded && pokemon ? (
          <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in fade-in duration-500">
             <div className="relative w-64 h-64 flex items-center justify-center">
                <Image 
                   src={pokemon.imageUrl} 
                   alt="Pokemon" 
                   width={256}
                   height={256}
                   className="object-contain transition-all duration-500"
                   style={getImageStyle()}
                />
             </div>
             
             <div className="w-full max-w-md space-y-4">
                <Input 
                    type="text" 
                    placeholder="Quel est ce Pokémon ?" 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    className="text-center text-xl py-6"
                    disabled={hasAnswered}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAnswerSubmit();
                    }}
                    autoFocus
                />
                
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
        ) : roundEnded && pokemon ? (
           <div className="w-full max-w-2xl flex flex-col items-center gap-6 animate-in zoom-in duration-300">
              <h2 className="text-3xl font-bold text-yellow-400">Résultats</h2>
              
              <div className="flex flex-col items-center gap-2 mb-4">
                 <div className="relative w-40 h-40 mb-2">
                    <Image 
                       src={pokemon.imageUrl} 
                       alt="Pokemon" 
                       width={160}
                       height={160}
                       className="object-contain"
                    />
                 </div>
                 <h3 className="text-2xl font-bold capitalize">{pokemon.names.fr || Object.values(pokemon.names)[0]}</h3>
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
                                <span className="font-bold">{res.player}</span>
                                <span className="text-xs text-gray-400">
                                    {res.answer} 
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {res.isCorrect ? (
                                <CheckCircle className="text-green-400 w-6 h-6" />
                            ) : (
                                <XCircle className="text-red-400 w-6 h-6" />
                            )}
                            <span className="font-bold text-xl">+{res.score} pts</span>
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
