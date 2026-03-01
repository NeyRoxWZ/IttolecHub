'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, Clock, DollarSign, Home, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

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
              if (currentPhase === 'playing' && !myPlayer.has_guessed) {
                  // Reset local state for new round
                  setUserGuess('');
                  setGuessTime(0);
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
      router.push(`/room/${roomCode}`);
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
      }).sort((a, b) => b.score - a.score);
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
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-in fade-in">
               <div className="relative">
                   <DollarSign className="w-24 h-24 text-green-400 animate-pulse" />
               </div>
               
               <div className="text-center space-y-2">
                   <h2 className="text-3xl font-bold text-white">Hollywood est prêt ?</h2>
                   <p className="text-gray-400">
                       Rounds : <span className="text-blue-400 font-bold">{totalRounds}</span> • 
                       Temps : <span className="text-purple-400 font-bold">{settings.time || 30}s</span>
                   </p>
               </div>

               {isHost ? (
                   <Button 
                       size="lg" 
                       onClick={startNewGame}
                       className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 shadow-lg border border-white/10 rounded-xl"
                   >
                       Lancer la partie
                   </Button>
               ) : (
                   <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full">
                       <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                       <span className="text-gray-300">En attente du producteur...</span>
                   </div>
               )}
            </div>
        )}

        {/* PHASE: PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentMovie && (
            <div className="flex flex-col items-center w-full max-w-4xl gap-6 pt-4 px-4">
                
                {/* MOVIE CARD */}
                <div className="flex flex-col md:flex-row bg-slate-800 rounded-2xl overflow-hidden shadow-2xl w-full">
                    {/* Poster */}
                    <div className="w-full md:w-1/3 aspect-[2/3] relative bg-black">
                        {currentMovie.poster_path ? (
                            <img src={currentMovie.poster_path} alt={currentMovie.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-500">Pas d'affiche</div>
                        )}
                    </div>
                    
                    {/* Info */}
                    <div className="w-full md:w-2/3 p-6 flex flex-col justify-between">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">{currentMovie.title}</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="bg-white/10 px-3 py-1 rounded-full text-sm font-bold text-white">{currentMovie.release_date}</span>
                                {currentMovie.genres && currentMovie.genres.map((g: string) => (
                                    <span key={g} className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-sm">{g}</span>
                                ))}
                            </div>
                        </div>

                        {/* BUDGET REVEAL */}
                        <div className="mt-8">
                            <h3 className="text-gray-400 text-sm uppercase tracking-wider font-bold mb-2">Budget de production</h3>
                            {currentPhase === 'round_results' ? (
                                <div className="text-4xl md:text-5xl font-black text-green-400 animate-in zoom-in">
                                    {formatCurrency(currentMovie.budget)}
                                </div>
                            ) : (
                                <div className="text-4xl md:text-5xl font-black text-slate-700 bg-slate-700 select-none blur-md rounded-lg w-3/4">
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
                            <div className="bg-blue-600/20 border border-blue-500/50 text-blue-300 p-4 rounded-xl text-center font-bold text-xl shadow-lg flex items-center justify-center gap-3">
                                <DollarSign className="w-6 h-6" />
                                Budget estimé ! Attente des autres...
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <Input 
                                        type="text" // text to allow formatting if we wanted, but let's stick to raw number for simplicity
                                        placeholder="Ex: 150000000" 
                                        value={userGuess}
                                        onChange={e => setUserGuess(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                                        className="h-16 pl-10 text-2xl font-bold bg-slate-900 border-white/20 text-white placeholder:text-gray-600 tracking-widest"
                                        autoFocus
                                    />
                                </div>
                                <Button 
                                    onClick={submitGuess}
                                    disabled={!userGuess.trim()}
                                    className="h-16 px-8 bg-green-600 hover:bg-green-500 font-bold text-lg"
                                >
                                    Valider
                                </Button>
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
                                <div key={p.id} className={`p-4 rounded-xl border flex items-center justify-between ${
                                    isWinner ? 'bg-green-500/10 border-green-500/50' : 'bg-slate-800 border-slate-700'
                                }`}>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-white">{p.name}</span>
                                        <span className="text-sm text-gray-400">Écart: {diff.toFixed(1)}%</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-xl text-white">{formatCurrency(p.last_guess)}</div>
                                        {/* Show points earned logic needed? Or just total score? */}
                                        {/* Ideally show +Points. We can infer it or store it. */}
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
                            <span className="text-2xl font-mono font-black text-green-400">{p.score} pts</span>
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
