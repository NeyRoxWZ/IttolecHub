'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, Clock, CheckCircle, XCircle, Zap, Loader2, Home, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Fuse from 'fuse.js';

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
  const currentRound = game.current_round || 1;
  const timerStartAt = game.timer_start_at;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  const timerSeconds = Number(settings.time || 30);
  const selectedGens = settings.gens || [1];
  const difficulty = settings.difficulty || 'normal';

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasGuessed, setHasGuessed] = useState(false);
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
              setIsCorrect(myPlayer.is_correct);
              
              if (currentPhase === 'playing' && !myPlayer.has_guessed) {
                  // Reset local state for new round
                  if (userAnswer) setUserAnswer('');
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
              const now = Date.now();
              const start = timerStartAt ? new Date(timerStartAt).getTime() : 0;
              const timeIsUp = start > 0 && (now > start + timerSeconds * 1000 + 1000); // 1s buffer
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

      const interval = setInterval(manageGame, 1000);
      return () => clearInterval(interval);
  }, [isHost, roomId, currentPhase, timerStartAt, timerSeconds, players.length, gamePlayers]);

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
      
      // Shuffle
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
          
          const ids = await getPokemonIdsForGens(selectedGens, totalRounds + 5); // +5 buffer
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
          
          // Clean old data
          await supabase.from('poke_players').delete().eq('room_id', roomId);
          await supabase.from('poke_players').insert(playerInserts);

          // Update Game
          await supabase.from('poke_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              timer_seconds: Number(timerSeconds),
              timer_start_at: new Date().toISOString(),
              current_pokemon: pokemon,
              queue: queue,
              difficulty: difficulty,
              generations: Array.isArray(selectedGens) ? selectedGens.map(Number) : [1],
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          toast.dismiss();
          toast.success("Un Pokémon sauvage apparaît !");

      } catch (e) {
          console.error(e);
          toast.dismiss();
          toast.error("Erreur au démarrage");
      }
  };

  const nextRound = async () => {
      if (!isHost || !roomId) return;

      const queue = game.queue || [];
      const currentRoundVal = game.current_round || 1;

      if (queue.length === 0 || currentRoundVal >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('poke_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextId = queue[0];
      const nextQueue = queue.slice(1);
      
      // Fetch next pokemon
      try {
        const res = await fetch(`/api/games/pokemon?id=${nextId}`);
        if (!res.ok) throw new Error("API Error");
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
            current_round: currentRoundVal + 1,
            current_pokemon: pokemon,
            queue: nextQueue,
            timer_start_at: new Date().toISOString()
        }).eq('room_id', roomId);
      } catch (e) {
        console.error("Next round error", e);
        // Force podium if error
        await supabase.from('poke_games').update({ phase: 'podium' }).eq('room_id', roomId);
      }
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || currentPhase !== 'playing') return;
      if (!currentPokemon) return;
      
      const names = Object.values(currentPokemon.names);
      
      // Fuzzy Matching
      const fuse = new Fuse(names, {
          includeScore: true,
          threshold: 0.25, // Tolerance (0.0 = perfect match, 1.0 = match anything)
      });
      
      const results = fuse.search(userAnswer);
      const isCorrectGuess = results.length > 0;

      const now = Date.now();
      const start = new Date(timerStartAt).getTime();
      const timeTaken = Math.max(0, now - start); // ms

      let points = 0;
      if (isCorrectGuess) {
          points = 100; // Base points
          // Speed bonus
          if (timeTaken < 5000) points += 50;
          if (timeTaken < 10000) points += 20;
      }

      // Update Player
      const myPlayer = players.find(p => p.id === playerId);
      const currentScore = myPlayer?.score || 0;

      await supabase.from('poke_players').update({
          has_guessed: true,
          last_guess: userAnswer,
          is_correct: isCorrectGuess,
          guess_time_ms: timeTaken,
          score: isCorrectGuess ? currentScore + points : currentScore // Wait, this updates poke_players score column, which is maybe unused if we use global score. But let's follow other games.
      }).match({ room_id: roomId, player_id: playerId });
      
      if (isCorrectGuess) {
          // Update Global Score
          await supabase.from('players').update({ score: currentScore + points }).eq('id', playerId);
          setScoreEarned(points);
      }

      setHasGuessed(true);
      setIsCorrect(isCorrectGuess);
      
      if (isCorrectGuess) {
          toast.success("Correct ! C'est " + names[0]);
      } else {
          toast.error("Raté !");
      }
  };

  // --- RENDER HELPERS ---
  const getImageStyle = () => {
      if (currentPhase === 'playing' && difficulty !== 'easy') {
          // Silhouette for normal/hard
          return { filter: 'brightness(0) grayscale(100%)', opacity: 1 };
      }
      return { filter: 'none', opacity: 1 };
  };

  // Players Map for GameLayout
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => {
        acc[p.name] = p.score;
        return acc;
    }, {} as Record<string, number>);
  }, [players]);

  return (
    <GameLayout
        gameTitle="PokeGuessr"
        roundCount={currentRound}
        maxRounds={totalRounds}
        timer={timeLeft.toString()}
        players={playersMap}
        timeLeft={timeLeft}
    >
        {/* SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="p-6 bg-gradient-to-br from-yellow-400 to-blue-500 rounded-full shadow-2xl animate-bounce">
                   <Zap className="w-16 h-16 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Quel est ce Pokémon ?</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md text-center">
                    Devinez le nom du Pokémon à partir de sa silhouette ou de son image !
                </p>
                
                {isHost ? (
                    <Button onClick={startNewGame} size="lg" className="w-full max-w-sm text-lg h-14 rounded-xl shadow-xl bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                        Lancer la partie
                    </Button>
                ) : (
                    <div className="flex items-center gap-2 text-yellow-500 animate-pulse">
                        <Clock className="w-5 h-5" />
                        <span>En attente du dresseur...</span>
                    </div>
                )}
            </div>
        )}

        {/* PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentPokemon && (
            <div className="flex flex-col items-center justify-center w-full h-full gap-8">
                
                {/* POKEMON IMAGE */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center drop-shadow-[0_0_25px_rgba(255,203,5,0.4)] transition-all duration-700">
                    {/* Using standard img tag to avoid Next.js domain config issues */}
                    <img 
                       src={currentPokemon.imageUrl} 
                       alt="Pokemon" 
                       className="w-full h-full object-contain transition-all duration-700"
                       style={getImageStyle()}
                    />
                </div>

                {/* REVEAL NAME (RESULTS) */}
                {currentPhase === 'round_results' && (
                    <div className="flex flex-col items-center animate-in zoom-in">
                        <h2 className="text-4xl sm:text-5xl font-black text-yellow-500 uppercase tracking-wider mb-2 drop-shadow-md">
                            {currentPokemon.names['fr'] || currentPokemon.names['en']}
                        </h2>
                        <span className="text-slate-400 text-lg font-mono">{currentPokemon.names['en']}</span>
                    </div>
                )}

                {/* INPUT AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full max-w-md animate-in slide-in-from-bottom-4 px-4">
                        {hasGuessed ? (
                            <div className={`p-6 rounded-2xl text-center font-bold text-2xl shadow-xl flex items-center justify-center gap-3 transform transition-all hover:scale-105 ${isCorrect ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
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
                                    className="h-16 text-xl bg-slate-900 border-yellow-500/30 focus:border-yellow-500 text-white placeholder:text-slate-500 text-center rounded-xl shadow-inner"
                                    autoFocus
                                />
                                <Button 
                                    onClick={submitGuess}
                                    disabled={!userAnswer.trim()}
                                    className="h-16 px-6 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20"
                                >
                                    <Send className="w-6 h-6" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 px-4 overflow-y-auto max-h-[30vh] custom-scrollbar">
                        {gamePlayers
                            .filter((p: any) => p.has_guessed)
                            .sort((a: any, b: any) => (b.is_correct === a.is_correct) ? 0 : b.is_correct ? 1 : -1)
                            .map((p: any) => {
                            const playerInfo = players.find(pl => pl.id === p.player_id);
                            return (
                                <div key={p.player_id} className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
                                    p.is_correct 
                                    ? 'bg-green-500/10 border-green-500/50 dark:bg-green-900/30' 
                                    : 'bg-red-500/10 border-red-500/50 dark:bg-red-900/30'
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                            p.is_correct ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                                        }`}>
                                            {playerInfo?.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 dark:text-slate-100">{playerInfo?.name}</span>
                                            <span className="text-xs text-slate-500">{p.last_guess || '-'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.is_correct ? <CheckCircle className="text-green-500 w-5 h-5" /> : <XCircle className="text-red-500 w-5 h-5" />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        )}

        {/* PODIUM */}
        {currentPhase === 'podium' && (
            <div className="flex flex-col items-center justify-center h-full space-y-8 w-full">
                <div className="flex items-end justify-center gap-4 h-64">
                    {/* 2nd Place */}
                    {players.sort((a, b) => b.score - a.score)[1] && (
                        <div className="flex flex-col items-center animate-in slide-in-from-bottom duration-700 delay-200">
                            <div className="w-20 h-20 rounded-full bg-slate-300 border-4 border-white shadow-xl flex items-center justify-center text-2xl font-bold text-slate-600 mb-4 relative">
                                {players.sort((a, b) => b.score - a.score)[1].name.charAt(0)}
                                <div className="absolute -bottom-3 bg-slate-500 text-white text-xs px-2 py-1 rounded-full">2ème</div>
                            </div>
                            <div className="w-24 h-32 bg-slate-300 rounded-t-lg flex items-end justify-center pb-4 shadow-lg">
                                <span className="font-bold text-slate-600">{players.sort((a, b) => b.score - a.score)[1].score} pts</span>
                            </div>
                        </div>
                    )}
                    
                    {/* 1st Place */}
                    {players.sort((a, b) => b.score - a.score)[0] && (
                        <div className="flex flex-col items-center z-10 animate-in slide-in-from-bottom duration-700">
                            <div className="w-24 h-24 rounded-full bg-yellow-400 border-4 border-white shadow-xl flex items-center justify-center text-3xl font-bold text-yellow-800 mb-4 relative">
                                <Trophy className="w-8 h-8 absolute -top-10 text-yellow-400 drop-shadow-lg animate-bounce" />
                                {players.sort((a, b) => b.score - a.score)[0].name.charAt(0)}
                                <div className="absolute -bottom-3 bg-yellow-600 text-white text-xs px-3 py-1 rounded-full">1er</div>
                            </div>
                            <div className="w-28 h-48 bg-yellow-400 rounded-t-lg flex items-end justify-center pb-4 shadow-xl">
                                <span className="font-bold text-yellow-900 text-xl">{players.sort((a, b) => b.score - a.score)[0].score} pts</span>
                            </div>
                        </div>
                    )}
                    
                    {/* 3rd Place */}
                    {players.sort((a, b) => b.score - a.score)[2] && (
                        <div className="flex flex-col items-center animate-in slide-in-from-bottom duration-700 delay-400">
                            <div className="w-20 h-20 rounded-full bg-orange-300 border-4 border-white shadow-xl flex items-center justify-center text-2xl font-bold text-orange-800 mb-4 relative">
                                {players.sort((a, b) => b.score - a.score)[2].name.charAt(0)}
                                <div className="absolute -bottom-3 bg-orange-600 text-white text-xs px-2 py-1 rounded-full">3ème</div>
                            </div>
                            <div className="w-24 h-24 bg-orange-300 rounded-t-lg flex items-end justify-center pb-4 shadow-lg">
                                <span className="font-bold text-orange-800">{players.sort((a, b) => b.score - a.score)[2].score} pts</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {isHost && (
                    <Button onClick={() => {
                        broadcast('return_to_lobby', {});
                        router.push(`/room/${roomCode}`);
                    }} size="lg" className="mt-8 bg-slate-700 hover:bg-slate-600">
                        Retour au salon
                    </Button>
                )}
            </div>
        )}
    </GameLayout>
  );
}
