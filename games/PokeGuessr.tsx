'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, Clock, CheckCircle, XCircle, Zap, Loader2, Home, Send } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

interface PokeGuessrProps {
  roomCode: string;
}

interface PokemonData {
  id: number;
  names: { [lang: string]: string };
  imageUrl: string;
  generation: string;
}

export default function PokeGuessr({ roomCode }: PokeGuessrProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    poke,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'poke');

  // --- DERIVED STATE ---
  const game = poke?.game || {};
  const gamePlayers = poke?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentPokemon = game.current_pokemon as PokemonData | null;
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 30;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  const selectedGens = settings.gens || [1];
  const difficulty = settings.difficulty || 'normal';

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessRank, setGuessRank] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreEarned, setScoreEarned] = useState(0);

  // --- EFFECTS ---
  
  // Return to Lobby Broadcast
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}`);
    }
  }, [lastEvent, roomCode, router]);

  // Timer Logic
  useEffect(() => {
    if (!timerStartAt || currentPhase !== 'playing') {
        if (currentPhase !== 'playing') setTimeLeft(0);
        return;
    }

    const start = new Date(timerStartAt).getTime();
    const duration = timerSeconds * 1000;
    
    const interval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((start + duration - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
            clearInterval(interval);
        }
    }, 200);

    return () => clearInterval(interval);
  }, [timerStartAt, timerSeconds, currentPhase]);

  // Sync Local Player State
  useEffect(() => {
      if (playerId) {
          const myPlayer = gamePlayers.find((p: any) => p.player_id === playerId);
          if (myPlayer) {
              setHasGuessed(myPlayer.has_guessed);
              setGuessRank(myPlayer.guess_rank);
              setIsCorrect(myPlayer.is_correct);
              
              if (currentPhase === 'playing' && !myPlayer.has_guessed) {
                  // Reset local state for new round
                  setUserAnswer('');
                  setScoreEarned(0);
                  setIsCorrect(false);
              }
          }
      }
  }, [gamePlayers, playerId, currentPhase]);

  // --- HOST LOGIC ---
  useEffect(() => {
      if (!isHost || !roomId) return;

      const manageGame = async () => {
          // 1. Playing -> Round Results (Time up or All Answered)
          if (currentPhase === 'playing') {
              const timeIsUp = timeLeft === 0 && timerStartAt && (Date.now() > new Date(timerStartAt).getTime() + timerSeconds * 1000);
              const allAnswered = players.length > 0 && gamePlayers.filter((p: any) => p.has_guessed).length >= players.length;

              if (timeIsUp || allAnswered) {
                  // Move to Results
                  await supabase.from('poke_games').update({
                      phase: 'round_results',
                      timer_start_at: null
                  }).eq('room_id', roomId);
                  
                  // Auto Next Round after 5s
                  setTimeout(async () => {
                      await nextRound();
                  }, 5000);
              }
          }
      };

      manageGame();
  }, [isHost, roomId, currentPhase, timeLeft, timerStartAt, timerSeconds, players.length, gamePlayers]);

  // --- ACTIONS ---

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

  const startNewGame = async () => {
      if (!isHost || !roomId) return;

      try {
          toast.loading("Chargement du Pokédex...");
          
          const ids = await getPokemonIdsForGens(selectedGens, totalRounds + 2);
          if (ids.length === 0) {
              toast.error("Aucun Pokémon trouvé pour ces générations");
              return;
          }

          const firstId = ids[0];
          // Fetch first pokemon details
          const res = await fetch(`/api/games/pokemon?id=${firstId}`);
          if (!res.ok) throw new Error("API Error");
          const pokemon = await res.json();
          
          const queue = ids.slice(1);
          
          const gamePayload = {
              ...pokemon
          };

          // Reset Players
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              score: 0,
              has_guessed: false,
              guess_rank: 0,
              guess_time_ms: 0,
              last_guess: null,
              is_correct: false
          }));
          
          await supabase.from('poke_players').delete().eq('room_id', roomId);
          await supabase.from('poke_players').insert(playerInserts);

          // Update Game
          await supabase.from('poke_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              timer_seconds: Number(settings.time || 30),
              timer_start_at: new Date().toISOString(),
              current_pokemon: gamePayload,
              queue: queue,
              difficulty: difficulty,
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          toast.dismiss();
          toast.success("Un Pokémon sauvage apparaît !");

      } catch (e) {
          console.error(e);
          toast.error("Erreur au démarrage");
      }
  };

  const nextRound = async () => {
      if (!isHost || !roomId) return;

      const queue = game.queue || [];
      const currentRound = game.current_round || 1;

      if (queue.length === 0 || currentRound >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('poke_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextId = queue[0];
      const nextQueue = queue.slice(1);
      
      // Fetch next pokemon
      const res = await fetch(`/api/games/pokemon?id=${nextId}`);
      if (!res.ok) return; // Should handle error
      const pokemon = await res.json();

      // Reset players guess state
      await supabase.from('poke_players').update({
          has_guessed: false,
          guess_rank: 0,
          guess_time_ms: 0,
          last_guess: null,
          is_correct: false
      }).eq('room_id', roomId);

      // Start next round
      await supabase.from('poke_games').update({
          phase: 'playing',
          current_round: currentRound + 1,
          current_pokemon: pokemon,
          queue: nextQueue,
          timer_start_at: new Date().toISOString()
      }).eq('room_id', roomId);
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || currentPhase !== 'playing') return;
      if (!currentPokemon) return;
      
      const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
      
      const userNorm = normalize(userAnswer);
      // Check all names (fr, en, etc.)
      const correctNames = Object.values(currentPokemon.names).map(n => normalize(n));
      const isCorrectGuess = correctNames.includes(userNorm);

      const now = Date.now();
      const start = new Date(timerStartAt).getTime();
      const timeTaken = Math.max(0, now - start); // ms

      let points = 0;
      if (isCorrectGuess) {
          // Score logic: <5s = 1000, <half = 700, else 400
          const midTime = (timerSeconds * 1000) / 2;
          if (timeTaken < 5000) points = 1000;
          else if (timeTaken < midTime) points = 700;
          else points = 400;
      }

      // Fetch current rank if correct
      let rank = 0;
      if (isCorrectGuess) {
          const { count } = await supabase.from('poke_players').select('*', { count: 'exact', head: true }).eq('room_id', roomId).eq('is_correct', true);
          rank = (count || 0) + 1;
      }

      setHasGuessed(true);
      setIsCorrect(isCorrectGuess);
      setScoreEarned(points);
      
      if (isCorrectGuess) toast.success(`Attrapé ! +${points} pts`);
      else toast.error("Oh non ! Le Pokémon s'est enfui...");

      // Update DB
      const { data: pData } = await supabase.from('poke_players').select('score').eq('room_id', roomId).eq('player_id', playerId).single();
      
      await supabase.from('poke_players').update({
          score: (pData?.score || 0) + points,
          has_guessed: true,
          guess_rank: rank,
          guess_time_ms: timeTaken,
          last_guess: userAnswer,
          is_correct: isCorrectGuess
      }).eq('room_id', roomId).eq('player_id', playerId);
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('poke_games').delete().eq('room_id', roomId);
      await supabase.from('poke_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}`);
  };

  // --- RENDER HELPERS ---
  const getImageStyle = () => {
      if (currentPhase === 'round_results' || currentPhase === 'podium') return {};
      switch(difficulty) {
          case 'easy': return { filter: 'blur(10px)' };
          case 'hard': return { filter: 'brightness(0) rotate(180deg)' };
          case 'normal': default: return { filter: 'brightness(0)' };
      }
  };

  const playersMap = useMemo(() => {
      return players.reduce((acc, p) => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { ...acc, [p.name]: gp?.score || 0 };
      }, {} as Record<string, number>);
  }, [players, gamePlayers]);

  const sortedPlayers = useMemo(() => {
      return [...players].map(p => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { 
              ...p, 
              score: gp?.score || 0,
              has_guessed: gp?.has_guessed,
              last_guess: gp?.last_guess,
              is_correct: gp?.is_correct
          };
      }).sort((a, b) => b.score - a.score);
  }, [players, gamePlayers]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={game.current_round || 0}
      maxRounds={game.total_rounds || totalRounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="PokéGuessr"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-in fade-in">
               <div className="relative">
                   <Zap className="w-24 h-24 text-yellow-400 animate-pulse" />
               </div>
               
               <div className="text-center space-y-2">
                   <h2 className="text-3xl font-bold text-white">Prêt pour l'aventure ?</h2>
                   <p className="text-gray-400">
                       Rounds : <span className="text-blue-400 font-bold">{totalRounds}</span> • 
                       Temps : <span className="text-purple-400 font-bold">{settings.time || 30}s</span>
                   </p>
               </div>

               {isHost ? (
                   <Button 
                       size="lg" 
                       onClick={startNewGame}
                       className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 shadow-lg border border-white/10 rounded-xl text-black"
                   >
                       Lancer la partie
                   </Button>
               ) : (
                   <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full">
                       <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                       <span className="text-gray-300">En attente du dresseur...</span>
                   </div>
               )}
            </div>
        )}

        {/* PHASE: PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentPokemon && (
            <div className="flex flex-col items-center w-full max-w-4xl gap-6 pt-4 px-4">
                
                {/* POKEMON IMAGE */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center drop-shadow-[0_0_15px_rgba(255,203,5,0.3)]">
                    <Image 
                       src={currentPokemon.imageUrl} 
                       alt="Pokemon" 
                       fill
                       className="object-contain transition-all duration-500"
                       style={getImageStyle()}
                       priority
                    />
                </div>

                {/* REVEAL NAME (RESULTS) */}
                {currentPhase === 'round_results' && (
                    <div className="flex flex-col items-center animate-in zoom-in">
                        <h2 className="text-4xl font-black text-yellow-400 uppercase tracking-wider mb-2">
                            {currentPokemon.names.fr || Object.values(currentPokemon.names)[0]}
                        </h2>
                        <span className="text-gray-400 text-sm">{currentPokemon.names.en}</span>
                    </div>
                )}

                {/* INPUT AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full max-w-md animate-in slide-in-from-bottom-4">
                        {hasGuessed ? (
                            <div className={`p-4 rounded-xl text-center font-bold text-xl shadow-lg flex items-center justify-center gap-3 ${isCorrect ? 'bg-green-600 text-white' : 'bg-red-600/50 text-white'}`}>
                                {isCorrect ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                                {isCorrect ? 'Attrapé !' : 'Raté...'}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Quel est ce Pokémon ?" 
                                    value={userAnswer}
                                    onChange={e => setUserAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitGuess()}
                                    className="h-14 text-lg bg-slate-900 border-yellow-500/30 focus:border-yellow-500 text-white placeholder:text-gray-500 text-center"
                                    autoFocus
                                />
                                <Button 
                                    onClick={submitGuess}
                                    disabled={!userAnswer.trim()}
                                    className="h-14 px-6 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {sortedPlayers.map(p => {
                            if (!p.has_guessed) return null;
                            return (
                                <div key={p.id} className={`p-4 rounded-xl border flex items-center justify-between ${
                                    p.is_correct ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'
                                }`}>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white">{p.name}</span>
                                        <span className="text-sm text-gray-400">{p.last_guess || '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.is_correct ? <CheckCircle className="text-green-400 w-5 h-5" /> : <XCircle className="text-red-400 w-5 h-5" />}
                                        <span className={`font-black text-lg ${p.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                                            {p.is_correct ? '+1000' : '+0'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* PHASE: PODIUM */}
        {currentPhase === 'podium' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h2 className="text-4xl font-black text-white mb-8">Classement Final</h2>
                
                <div className="w-full space-y-2 mb-8">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl ${
                            i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border border-yellow-500/50' : 
                            i === 1 ? 'bg-white/10' : 
                            i === 2 ? 'bg-white/5' : 'opacity-50'
                        }`}>
                            <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black ${
                                    i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white'
                                }`}>{i + 1}</span>
                                <span className="text-xl font-bold text-white">{p.name}</span>
                            </div>
                            <span className="text-2xl font-mono font-black text-yellow-400">{p.score} pts</span>
                        </div>
                    ))}
                </div>

                {isHost && (
                    <Button onClick={returnToLobby} className="w-full h-14 text-lg font-bold bg-white text-black hover:bg-gray-200 rounded-xl">
                        <Home className="w-5 h-5 mr-2" /> Retour au salon
                    </Button>
                )}
            </div>
        )}

      </div>
    </GameLayout>
  );
}
