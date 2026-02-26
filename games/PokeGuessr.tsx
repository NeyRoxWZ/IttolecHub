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
  
  // Settings
  const [selectedGens, setSelectedGens] = useState<number[]>([1]);

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
      if (gameState.settings.gens && Array.isArray(gameState.settings.gens)) {
          // Avoid loop if same
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
              gens: selectedGens 
          };
          
          // Check if different to avoid loop
          if (JSON.stringify(newSettings) !== JSON.stringify(gameState?.settings)) {
               updateSettings(newSettings);
          }
      }
  }, [maxRounds, roundTime, selectedGens, isHost]);

  // Sync Timer
  useEffect(() => {
    if (gameState?.round_data?.endTime) {
      const end = gameState.round_data.endTime;
      const now = Date.now();
      const diff = Math.ceil((end - now) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    }
  }, [gameState?.round_data?.endTime, gameStarted, roundEnded]);

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
      // Helper to get random IDs from selected generations
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
      // Default to gen 1 if empty or undefined
      const safeGens = (!gens || gens.length === 0) ? [1] : gens;
      
      safeGens.forEach(g => {
          const limit = genLimits[g as keyof typeof genLimits];
          if (limit) {
              for (let i = limit.min; i <= limit.max; i++) {
                  allIds.push(i);
              }
          }
      });
      
      // Shuffle and pick
      for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
      }
      
      return allIds.slice(0, count);
  };

  const startRound = async () => {
    if (!isHost || !roomCode) return;

    try {
      // Get IDs
      const ids = await getPokemonIdsForGens(selectedGens, maxRounds);
      
      if (ids.length === 0) return;

      const firstId = ids[0];
      const pokemon = await fetchPokemon(firstId);
      const queue = ids.slice(1);
      const endTime = Date.now() + roundTime * 1000;
      
      await startGame({
        pokemon,
        queue, // Store IDs in queue
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
      
      let nextId;
      let nextQueue = [];

      if (queue.length === 0) {
          // Fetch one more random
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
         endTime
      });
      setUserAnswer('');
    } catch (e) {
       console.error('Error next round', e);
    }
  };

  const handleAnswer = () => {
    if (!userAnswer.trim() || roundEnded) return;
    submitAnswer(userAnswer.trim());
  };

  const endRound = async () => {
    if (!isHost || !pokemon || !gameState) return;

    const correctNames = Object.values(pokemon.names).map(n => n.toLowerCase());
    
    const answers = gameState.answers || {};
    const results: PlayerAnswer[] = [];
    
    const updatedScores: Record<string, number> = {};

    for (const p of players) {
        const pAnswer = answers[p.id]?.answer;
        let isCorrect = false;
        
        if (pAnswer) {
             isCorrect = correctNames.includes(pAnswer.toLowerCase());
        }
        
        results.push({
            player: p.name,
            answer: pAnswer || '-',
            isCorrect
        });

        if (isCorrect) {
            await updatePlayerScore(p.id, p.score + 10);
        }
    }
    
    // Update round data
    await updateRoundData({
        ...gameState.round_data,
        results
    });
    
    await setGameStatus('round_results');
  };

  // Typing logic
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
  
  useEffect(() => {
    if (!typingPlayer) return;
    const timeout = setTimeout(() => setTypingPlayer(null), 3000);
    return () => clearTimeout(timeout);
  }, [typingPlayer]);
  
  // Helpers for UI
  const playerResults = useMemo(() => {
      if (gameState?.round_data?.results) {
          return gameState.round_data.results as PlayerAnswer[];
      }
      return [];
  }, [gameState?.round_data?.results]);

  const answeredPlayers = useMemo(() => {
      if (gameState?.answers) {
          return Object.keys(gameState.answers).map(pid => {
              const p = players.find(pl => pl.id === pid);
              return p ? p.name : 'Unknown';
          });
      }
      return [];
  }, [gameState?.answers, players]);

  // Checkbox toggle
  const toggleGen = (gen: number) => {
      setSelectedGens(prev => {
          if (prev.includes(gen)) {
              if (prev.length === 1) return prev; // Keep at least one
              return prev.filter(g => g !== gen);
          }
          return [...prev, gen];
      });
      // Host should verify update settings if needed, but we do it on start or useEffect sync
      if (isHost) {
          // We don't sync partial changes immediately to avoid spam, or we do.
          // Let's sync when start game or use a specific button "Save Settings" if complex.
          // Or just update local state and sync when startGame is called?
          // But non-hosts need to see it.
          // I'll sync immediately for better UX.
          // Need to wrap in useEffect or call updateSettings.
          // But setState is async.
          // I'll skip immediate sync for now, let's rely on startRound sending the config used?
          // No, plan says "Non-hosts voient les paramètres en lecture seule".
          // So I must sync.
          // I'll use a useEffect to sync `selectedGens` to settings.
      }
  };

  useEffect(() => {
      if (isHost) {
          updateSettings({ ...gameState?.settings, gens: selectedGens });
      }
  }, [selectedGens, isHost]); // Be careful with infinite loops if updateSettings updates gameState which updates selectedGens

  // To avoid loop: Only update if different.
  // And `useEffect` above: `if (gameState.settings.gens) setSelectedGens(...)`.
  // This will cause loop if not careful.
  // I should check deep equality or just rely on Host being the source of truth.
  // If I am host, I drive the state. I don't listen to gameState settings for MYSELF.
  // I updated the useEffect:
  /*
  useEffect(() => {
    if (gameState?.settings) {
       // Only if NOT host?
       if (!isHost) {
          if (gameState.settings.gens) setSelectedGens(gameState.settings.gens);
       }
       // ...
    }
  }, [gameState?.settings, isHost]);
  */
  // I'll fix the useEffect above.

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
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">En attente du lancement...</h2>
            {isHost ? (
              <div className="p-4 bg-white/10 rounded-lg backdrop-blur-sm w-full max-w-lg">
                <p className="mb-4">Configurez la partie :</p>
                <div className="grid grid-cols-2 gap-4 text-left mb-6">
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <Input 
                        type="number" 
                        value={maxRounds} 
                        onChange={e => setMaxRounds(parseInt(e.target.value))} 
                        className="bg-white/5 border-white/10"
                      />
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Temps (s)</span>
                      <Input 
                        type="number" 
                        value={roundTime} 
                        onChange={e => setRoundTime(parseInt(e.target.value))} 
                        className="bg-white/5 border-white/10"
                      />
                   </div>
                </div>
                
                <div className="mb-6">
                    <span className="text-sm text-gray-400 block mb-2">Générations</span>
                    <div className="grid grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => (
                            <button
                                key={g}
                                onClick={() => toggleGen(g)}
                                className={`p-2 rounded text-xs font-bold transition-colors ${
                                    selectedGens.includes(g) 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                Gen {g}
                            </button>
                        ))}
                    </div>
                </div>

                <Button size="lg" onClick={startRound} className="w-full">
                  Lancer la partie
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p>L'hôte configure la partie...</p>
                 <div className="grid grid-cols-2 gap-4 text-left max-w-md mx-auto mt-4 opacity-75">
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Rounds</span>
                      <span className="font-bold">{maxRounds}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm text-gray-400">Générations</span>
                      <span className="font-bold">{selectedGens.join(', ')}</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {pokemon && (
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto mb-4">
                 <Image
                    src={pokemon.imageUrl}
                    alt="Pokemon"
                    fill
                    className={`object-contain transition-all duration-1000 ${
                        !roundEnded ? 'brightness-0 blur-md grayscale opacity-80' : 'brightness-100 blur-0 grayscale-0 opacity-100'
                    }`}
                    priority
                 />
              </div>
            )}

            {!roundEnded ? (
              <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Quel est ce Pokémon ?"
                    value={userAnswer}
                    onChange={(e) => {
                      setUserAnswer(e.target.value);
                      broadcast({
                        type: 'typing',
                        data: { player: playerName, isTyping: e.target.value.length > 0 },
                      });
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                    className="h-14 text-lg pr-12 text-center font-bold uppercase"
                    autoFocus
                  />
                  <div className="absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center text-gray-400">
                    <Zap className="w-5 h-5" />
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full h-14 text-lg font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                  onClick={handleAnswer}
                >
                  Valider
                </Button>
                
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
                  <h3 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                    C'était...
                  </h3>
                  <div className="text-5xl font-black text-white mb-2 capitalize">
                    {pokemon?.names['fr'] || pokemon?.names['en']}
                  </div>
                </div>

                <div className="space-y-3 mb-8 max-h-60 overflow-y-auto custom-scrollbar">
                  {playerResults.map((p, i) => (
                    <div
                      key={p.player}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        p.isCorrect
                          ? 'bg-green-500/10 border border-green-500/30'
                          : 'bg-red-500/10 border border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-lg">{p.player}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg uppercase">{p.answer}</span>
                        {p.isCorrect ? <CheckCircle className="text-green-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
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
