'use client';

import { useState, useEffect, useMemo, useRef } from 'react';


import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';
import { Trophy, Clock, DollarSign, Home, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

import { vibrate, HAPTIC } from '@/lib/haptic';

interface BudgetGuesserProps {
  roomCode: string;
}

export default function BudgetGuesser({ roomCode }: BudgetGuesserProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    budget,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'budget');

  // --- DERIVED STATE ---
  const game = budget?.game || {};
  const gamePlayers = budget?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentMovie = game.current_movie;
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 30;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  // decade, difficulty handled by API fetch in Host logic

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userGuess, setUserGuess] = useState('');
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessTime, setGuessTime] = useState(0);

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
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state for new round
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserGuess('');
          setGuessTime(0);
          setHasGuessed(false);
      }
  }, [currentMovie?.id, currentPhase]);

  // --- HOST LOGIC ---
  useEffect(() => {
      if (!isHost || !roomId) return;

      const manageGame = async () => {
          // 1. Playing -> Round Results (Time up or All Answered)
          if (currentPhase === 'playing') {
              const timeIsUp = timeLeft === 0 && timerStartAt && (Date.now() > new Date(timerStartAt).getTime() + timerSeconds * 1000);
              const allAnswered = players.length > 0 && gamePlayers.filter((p: any) => p.has_guessed).length >= players.length;

              if (timeIsUp || allAnswered) {
                  // Calculate Scores
                  // We need to fetch latest guesses first?
                  // gamePlayers should be up to date via Realtime
                  
                  const updates = gamePlayers.map((p: any) => {
                      if (!p.has_guessed || !p.last_guess) return null; // No score change
                      
                      const actualBudget = currentMovie.budget;
                      const guess = p.last_guess;
                      const diffPercent = Math.abs(guess - actualBudget) / actualBudget * 100;
                      
                      let points = 0;
                      if (diffPercent < 5) points = 1000;
                      else if (diffPercent < 15) points = 700;
                      else if (diffPercent < 30) points = 400;
                      else if (diffPercent < 50) points = 200;
                      
                      // Bonus speed (< 10s)
                      if (p.guess_time_ms <= 10000 && points > 0) points += 200;
                      
                      return {
                          room_id: roomId,
                          player_id: p.player_id,
                          score: (p.score || 0) + points,
                          guess_diff_percent: diffPercent
                      };
                  }).filter(Boolean);

                  if (updates.length > 0) {
                      await supabase.from('budget_players').upsert(updates);
                  }

                  // Move to Results
                  await supabase.from('budget_games').update({
                      phase: 'round_results',
                      timer_start_at: null
                  }).eq('room_id', roomId);
                  
                  // Auto Next Round after 4s
                  setTimeout(async () => {
                      await nextRound();
                  }, 4000);
              }
          }
      };

      manageGame();
  }, [isHost, roomId, currentPhase, timeLeft, timerStartAt, timerSeconds, players.length, gamePlayers]);

  // --- ACTIONS ---

  const startNewGame = async () => {
      if (!isHost || !roomId) return;

      try {
          toast.loading("Recherche de films...");
          
          // Fetch movies
          const count = totalRounds + 2;
          const decade = settings.decade || 'all';
          const difficulty = settings.difficulty || 'normal';
          
          const res = await fetch(`/api/games/budget?count=${count}&decade=${decade}&difficulty=${difficulty}`);
          if (!res.ok) throw new Error("API Error");
          const movies = await res.json();
          
          if (!movies || movies.length === 0) {
              toast.error("Aucun film trouvé");
              return;
          }

          const firstMovie = movies[0];
          const queue = movies.slice(1);
          
          const gamePayload = {
              ...firstMovie,
              queue: queue // Storing queue in current_movie logic (reused from Wiki/Flag)
          };

          // Reset Players
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              score: 0,
              has_guessed: false,
              last_guess: 0,
              guess_time_ms: 0,
              guess_diff_percent: 0
          }));
          
          await supabase.from('budget_players').delete().eq('room_id', roomId);
          await supabase.from('budget_players').insert(playerInserts);

          // Update Game
          await supabase.from('budget_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              timer_seconds: Number(settings.time || 30),
              timer_start_at: new Date().toISOString(),
              current_movie: gamePayload,
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          toast.dismiss();
          toast.success("Action !");

      } catch (e) {
          console.error(e);
          toast.error("Erreur au démarrage");
      }
  };

  const nextRound = async () => {
      if (!isHost || !roomId || !currentMovie) return;

      const queue = currentMovie.queue || [];
      const currentRound = game.current_round || 1;

      if (queue.length === 0 || currentRound >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('budget_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextMovie = queue[0];
      const nextQueue = queue.slice(1);
      
      const gamePayload = {
          ...nextMovie,
          queue: nextQueue
      };

      // Reset players guess state
      await supabase.from('budget_players').update({
          has_guessed: false,
          last_guess: 0,
          guess_time_ms: 0,
          guess_diff_percent: 0
      }).eq('room_id', roomId);

      // Start next round
      await supabase.from('budget_games').update({
          phase: 'playing',
          current_round: currentRound + 1,
          current_movie: gamePayload,
          timer_start_at: new Date().toISOString()
      }).eq('room_id', roomId);
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || currentPhase !== 'playing') return;
      
      const guess = parseInt(userGuess.replace(/[^0-9]/g, ''), 10);
      if (isNaN(guess) || guess <= 0) return;

      const now = Date.now();
      const start = new Date(timerStartAt).getTime();
      const timeTaken = Math.max(0, now - start); // ms

      // Optimistic update
      setHasGuessed(true);
      vibrate(HAPTIC.MEDIUM);
      toast.success("Budget estimé !");

      // Update DB
      await supabase.from('budget_players').update({
          has_guessed: true,
          last_guess: guess,
          guess_time_ms: timeTaken
      }).eq('room_id', roomId).eq('player_id', playerId);
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      await supabase.from('budget_games').delete().eq('room_id', roomId);
      await supabase.from('budget_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('budget_games').delete().eq('room_id', roomId);
      await supabase.from('budget_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- RENDER ---
  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const sortedPlayers = useMemo(() => {
      return [...players].map(p => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { 
              ...p, 
              score: gp?.score || 0,
              has_guessed: gp?.has_guessed,
              last_guess: gp?.last_guess,
              guess_diff_percent: gp?.guess_diff_percent
          };
      }).sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  }, [players, gamePlayers]);

  const playersMap = useMemo(() => {
      return players.reduce((acc, p) => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { ...acc, [p.name]: gp?.score || 0 };
      }, {} as Record<string, number>);
  }, [players, gamePlayers]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={game.current_round || 0}
      maxRounds={game.total_rounds || totalRounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="BudgetGuessr"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
      voteToLobby={currentPhase !== 'setup' ? <VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} /> : undefined}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
               <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                   <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform -rotate-3">
                       <DollarSign className="w-16 h-16 text-accent-success" />
                   </div>
                   
                   <div className="text-center space-y-2 mb-8">
                        <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">Hollywood est prêt ?</h2>
                       <p className="text-tx-secondary font-bold">
                           Rounds : <span className="text-accent-primary font-black uppercase tracking-widest">{totalRounds}</span> • 
                           Temps : <span className="text-[#06B6D4] font-black uppercase tracking-widest">{settings.time || 30}s</span>
                       </p>
                   </div>

                   {isHost ? (
                       <button 
                           onClick={startNewGame}
                           className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success shadow-brutal"
                       >
                           LANCER LA PARTIE
                       </button>
                   ) : (
                        <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                            <Loader2 className="w-6 h-6 animate-spin text-accent-success" />
                            <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                       </div>
                   )}
               </div>
            </div>
        )}

        {/* PHASE: PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentMovie && (
            <div className="flex flex-col items-center w-full max-w-4xl gap-6 pt-4 px-4">
                
                {/* MOVIE CARD */}
                <div className="flex flex-col md:flex-row bg-brand-card rounded-[32px] overflow-hidden shadow-brutal border-4 border-brand-border w-full p-4 gap-6">
                    {/* Poster */}
                    <div className="w-full md:w-1/3 aspect-[2/3] relative bg-brand-inner rounded-2xl overflow-hidden border-4 border-brand-border shadow-inner">
                        {currentMovie.poster_path ? (
                            <img src={currentMovie.poster_path} alt={currentMovie.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-tx-muted font-bold uppercase tracking-widest">Pas d'affiche</div>
                        )}
                    </div>
                    
                    {/* Info */}
                    <div className="w-full md:w-2/3 flex flex-col justify-between p-2">
                        <div>
                            <h2 className="font-display text-3xl md:text-5xl font-black text-tx-base mb-4 uppercase tracking-wider leading-tight">{currentMovie.title}</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="bg-brand-inner border-2 border-brand-border px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest text-tx-base">{currentMovie.release_date}</span>
                                {currentMovie.genres && currentMovie.genres.map((g: string) => (
                                    <span key={g} className="bg-accent-primary/20 border-2 border-accent-primary text-accent-primary px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest">{g}</span>
                                ))}
                            </div>
                        </div>

                        {/* BUDGET REVEAL */}
                        <div className="mt-8 bg-brand-inner border-4 border-brand-border p-6 rounded-2xl shadow-brutal">
                            <h3 className="text-tx-secondary text-sm font-black uppercase tracking-widest mb-2">Budget de production</h3>
                            {currentPhase === 'round_results' ? (
                                <div className="font-display text-4xl md:text-5xl font-black text-accent-success animate-in zoom-in">
                                    {formatCurrency(currentMovie.budget)}
                                </div>
                            ) : (
                                <div className="font-display text-4xl md:text-5xl font-black text-tx-muted bg-brand-bg/50 select-none blur-[10px] rounded-xl px-4 py-2 inline-block">
                                    $999,999,999
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* INPUT AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full max-w-xl animate-in slide-in-from-bottom-4">
                        {hasGuessed ? (
                            <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl font-display text-xl font-black uppercase tracking-wider shadow-brutal flex items-center justify-center gap-3 text-tx-base">
                                <DollarSign className="w-6 h-6 text-accent-success" />
                                Budget estimé ! Attente des autres...
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-tx-secondary w-6 h-6" />
                                    <input 
                                        type="text"
                                        placeholder="Ex: 150000000" 
                                        value={userGuess}
                                        onChange={e => setUserGuess(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                                        className="w-full h-16 pl-14 pr-4 text-2xl font-bold bg-brand-inner border-4 border-brand-border focus:border-tx-base text-tx-base placeholder:text-tx-muted rounded-2xl shadow-brutal outline-none transition-colors"
                                        autoFocus
                                    />
                                </div>
                                <button 
                                    onClick={submitGuess}
                                    disabled={!userGuess.trim()}
                                    className="h-16 px-8 bg-accent-success hover:bg-tx-base text-brand-bg font-display font-black tracking-wider rounded-2xl shadow-brutal border-4 border-brand-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    VALIDER
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        {sortedPlayers.map(p => {
                            if (!p.last_guess) return null;
                            const diff = p.guess_diff_percent || 0;
                            const isWinner = diff < 15;
                            
                            return (
                                <div key={p.id} className={cn(
                                    "p-4 rounded-2xl border-4 border-brand-border flex items-center justify-between shadow-brutal",
                                    isWinner ? "bg-accent-success/20 border-accent-success" : "bg-brand-inner"
                                )}>
                                    <div className="flex flex-col">
                                        <span className="font-display font-black text-lg text-tx-base">{p.name}</span>
                                        <span className="text-sm font-bold text-tx-secondary uppercase tracking-widest">Écart: {diff.toFixed(1)}%</span>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "font-display font-black text-xl",
                                            isWinner ? "text-accent-success" : "text-tx-base"
                                        )}>{formatCurrency(p.last_guess)}</div>
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
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <Trophy className="w-16 h-16 text-accent-success" />
                    </div>
                    <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                    
                    <div className="w-full space-y-4 mb-8">
                        {sortedPlayers.map((p, i) => (
                            <div key={p.id} className={cn(
                                "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                i === 0 ? "bg-accent-success text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                            )}>
                                {/* Badges */}
                                {i === 0 && (
                                    <div className="absolute -top-4 -right-4 bg-accent-primary text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                        Producteur
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4">
                                    <span className={cn(
                                        "w-12 h-12 flex items-center justify-center rounded-xl font-display font-black text-2xl border-2 border-brand-border",
                                        i === 0 ? "bg-accent-primary text-brand-bg" : "bg-brand-bg text-tx-base"
                                    )}>
                                        {i + 1}
                                    </span>
                                    
                                    <div className="flex flex-col text-left">
                                        <span className="text-xl font-display font-black">{p.name}</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-widest",
                                            i === 0 ? "text-brand-bg/80" : "text-tx-secondary"
                                        )}>
                                            {i === 0 ? '💰 Banquier' : '📉 Économe'}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "text-3xl font-display font-black",
                                    i === 0 ? "text-brand-bg" : "text-accent-success"
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
      </div>
    </GameLayout>
  );
}
