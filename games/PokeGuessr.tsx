'use client';

import { useState, useEffect, useMemo, useRef } from 'react';


import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, Clock, CheckCircle, XCircle, Zap, Loader2, Home, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import Fuse from 'fuse.js';
import { vibrate, HAPTIC } from '@/lib/haptic';
import VoteToLobby from './components/VoteToLobby';

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
        router.push(`/room/${roomCode}?return=true`);
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
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state on new round
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserAnswer('');
          setScoreEarned(0);
          setHasGuessed(false);
          setIsCorrect(false);
      }
  }, [currentPokemon?.id, currentPhase]);

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

  // Helper: Levenshtein Distance
  const levenshteinDistance = (a: string, b: string) => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;
      const matrix = [];
      for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
      for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
      for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
              if (b.charAt(i - 1) === a.charAt(j - 1)) {
                  matrix[i][j] = matrix[i - 1][j - 1];
              } else {
                  matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
              }
          }
      }
      return matrix[b.length][a.length];
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || currentPhase !== 'playing') return;
      if (!currentPokemon) return;
      
      const userAnswerNorm = userAnswer.trim().toLowerCase();
      if (userAnswerNorm.length < 2) return; // Prevent 1 char guesses

      const names = Object.values(currentPokemon.names).map((n: any) => n.toLowerCase());
      
      // Strict Matching with Levenshtein
      let isCorrectGuess = false;
      
      for (const name of names) {
          if (name === userAnswerNorm) {
              isCorrectGuess = true;
              break;
          }
          
          // Max 1 error for short names, 2 for longer
          const threshold = name.length > 5 ? 2 : 1;
          if (levenshteinDistance(userAnswerNorm, name) <= threshold) {
              isCorrectGuess = true;
              break;
          }
      }
      
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
          score: isCorrectGuess ? currentScore + points : currentScore 
      }).match({ room_id: roomId, player_id: playerId });
      
      if (isCorrectGuess) {
          // Update Global Score
          await supabase.from('players').update({ score: currentScore + points }).eq('id', playerId);
          setScoreEarned(points);
      }

      setHasGuessed(true);
      setIsCorrect(isCorrectGuess);
      
      if (isCorrectGuess) {
          vibrate(HAPTIC.SUCCESS);
          toast.success("Correct ! C'est " + Object.values(currentPokemon.names)[0]);
      } else {
          vibrate(HAPTIC.ERROR);
          toast.error("Raté !");
      }
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('poke_games').delete().eq('room_id', roomId);
      await supabase.from('poke_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('poke_games').delete().eq('room_id', roomId);
      await supabase.from('poke_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- RENDER HELPERS ---
  const getImageStyle = () => {
      if (currentPhase === 'playing') {
          if (difficulty === 'easy') {
              // Facile: Flou (Blur)
              return { filter: 'blur(15px)', opacity: 1 };
          } else if (difficulty === 'hard') {
              // Difficile: Renversé (Upside Down)
              // User doubted it was reversed, so let's make sure it is.
              // Assuming Hard is just Reversed Image (visible but upside down) to differentiate from Silhouette?
              // Or Upside Down Silhouette?
              // Prompt said: "Difficulté (Silhouette / Image nette)". 
              // Settings said: "Hard (Renversé)".
              // Let's do Upside Down Silhouette for max difficulty.
              return { filter: 'brightness(0)', transform: 'rotate(180deg)', opacity: 1 };
          }
          // Normal (default): Silhouette
          return { filter: 'brightness(0)', opacity: 1 };
      }
      // Results: Reveal
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
        voteToLobby={currentPhase !== 'setup' ? <VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} /> : undefined}
    >
        {/* SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in">
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full max-w-lg text-center">
                    <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform -rotate-6">
                        <Zap className="w-16 h-16 text-[#FFD000]" />
                    </div>
                    
                    <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider mb-4">
                        Quel est ce <span className="text-[#FFD000]">Pokémon</span> ?
                    </h2>
                    <p className="text-tx-secondary font-bold text-lg mb-8">
                        Devinez le nom du Pokémon à partir de sa silhouette ou de son image !
                    </p>

                    {isHost ? (
                        <button 
                            onClick={startNewGame} 
                            className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                        >
                            LANCER LA PARTIE
                        </button>
                    ) : (
                        <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                            <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
                            <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentPokemon && (
            <div className="flex flex-col items-center justify-center w-full h-full gap-8 p-4">
                
                {/* POKEMON IMAGE */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center transition-all duration-700 min-h-[16rem] bg-brand-inner border-4 border-brand-border rounded-3xl shadow-brutal p-8">
                    <img 
                       key={currentPokemon.id || currentRound}
                       src={currentPokemon.imageUrl} 
                       alt="Pokemon" 
                       draggable={false}
                       loading="eager"
                       width={320}
                       height={320}
                       onContextMenu={(e) => e.preventDefault()}
                       className="w-full h-full object-contain select-none transition-all duration-700"
                       style={getImageStyle()}
                    />
                </div>

                {/* REVEAL NAME (RESULTS) */}
                {currentPhase === 'round_results' && (
                    <div className="flex flex-col items-center animate-in zoom-in bg-brand-card border-4 border-brand-border px-10 py-6 rounded-3xl shadow-brutal transform rotate-2">
                        <h2 className="font-display text-4xl sm:text-5xl font-black text-[#FFD000] uppercase tracking-wider mb-2">
                            {currentPokemon.names['fr'] || currentPokemon.names['en']}
                        </h2>
                        <span className="text-tx-secondary font-bold text-lg font-mono uppercase tracking-widest bg-brand-inner px-4 py-1 rounded-lg border-2 border-brand-border">
                            {currentPokemon.names['en']}
                        </span>
                    </div>
                )}

                {/* INPUT AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full max-w-md animate-in slide-in-from-bottom-4 relative z-50">
                        {hasGuessed ? (
                            <div className={cn(
                                "p-6 rounded-2xl font-display text-2xl font-black uppercase tracking-wider shadow-brutal flex items-center justify-center gap-3 border-4 border-brand-border",
                                isCorrect ? "bg-accent-success text-brand-bg" : "bg-accent-secondary text-brand-bg"
                            )}>
                                {isCorrect ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                                {isCorrect ? 'Attrapé !' : 'Raté...'}
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <input 
                                    placeholder="Quel est ce Pokémon ?" 
                                    value={userAnswer}
                                    onChange={e => setUserAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitGuess()}
                                    className="flex-1 h-16 text-xl bg-brand-inner border-4 border-brand-border focus:border-tx-base text-tx-base placeholder:text-tx-muted text-center rounded-2xl shadow-brutal outline-none font-bold transition-colors"
                                    autoFocus
                                />
                                <button 
                                    onClick={submitGuess}
                                    disabled={!userAnswer.trim()}
                                    className="h-16 w-20 bg-[#FFD000] hover:bg-tx-base text-brand-bg font-black rounded-2xl shadow-brutal border-4 border-brand-border flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-6 h-6" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 overflow-y-auto max-h-[30vh] custom-scrollbar p-2">
                        {gamePlayers
                            .filter((p: any) => p.has_guessed)
                            .sort((a: any, b: any) => (b.is_correct === a.is_correct) ? 0 : b.is_correct ? 1 : -1)
                            .map((p: any) => {
                            const playerInfo = players.find(pl => pl.id === p.player_id);
                            return (
                                <div key={p.player_id} className={cn(
                                    "p-4 rounded-2xl border-4 border-brand-border flex items-center justify-between shadow-brutal bg-brand-card",
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-xl border-2 border-brand-border",
                                            p.is_correct ? "bg-accent-success text-brand-bg" : "bg-accent-secondary text-brand-bg"
                                        )}>
                                            {playerInfo?.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-display font-black text-lg text-tx-base">{playerInfo?.name}</span>
                                            <span className="text-sm font-bold text-tx-secondary uppercase tracking-widest">{p.last_guess || '-'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {p.is_correct ? <CheckCircle className="text-accent-success w-6 h-6" /> : <XCircle className="text-accent-secondary w-6 h-6" />}
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
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <Trophy className="w-16 h-16 text-[#FFD000]" />
                    </div>
                    <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                    
                    <div className="w-full space-y-4 mb-8">
                        {players.sort((a, b) => b.score - a.score).map((p, i) => (
                            <div key={p.id} className={cn(
                                "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                i === 0 ? "bg-accent-primary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                            )}>
                                {/* Badges */}
                                {i === 0 && (
                                    <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                        Maître Pokémon
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4">
                                    <span className={cn(
                                        "w-12 h-12 flex items-center justify-center rounded-xl font-display font-black text-2xl border-2 border-brand-border",
                                        i === 0 ? "bg-[#FFD000] text-brand-bg" : "bg-brand-bg text-tx-base"
                                    )}>
                                        {i + 1}
                                    </span>
                                    
                                    <div className="flex flex-col text-left">
                                        <span className="text-xl font-display font-black">{p.name}</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-widest",
                                            i === 0 ? "text-brand-bg/80" : "text-tx-secondary"
                                        )}>
                                            {i === 0 ? '⚡ Le plus rapide' : '🎯 Précision mortelle'}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "text-3xl font-display font-black",
                                    i === 0 ? "text-brand-bg" : "text-[#FFD000]"
                                )}>{p.score}</span>
                            </div>
                        ))}
                    </div>
                    
                    {isHost && (
                        <button 
                            onClick={returnToLobby} 
                            className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg shadow-brutal"
                        >
                            RETOUR AU SALON
                        </button>
                    )}
                </div>
            </div>
        )}
    </GameLayout>
  );
}
