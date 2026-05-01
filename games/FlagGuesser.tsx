'use client';

import { useState, useEffect, useMemo, useRef } from 'react';


import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';
import { Trophy, CheckCircle, XCircle, Clock, Flag, Loader2, Home, LogOut, ArrowRight, Play, Globe } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { vibrate, HAPTIC } from '@/lib/haptic';

interface FlagGuesserProps {
  roomCode: string;
}

export default function FlagGuesser({ roomCode }: FlagGuesserProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    flag,
    updateRoundData,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'flag');

  // --- DERIVED STATE ---
  const game = flag?.game || {};
  const gamePlayers = flag?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentFlag = game.current_flag;
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 20;
  
  // Settings (from gameState which comes from rooms table)
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 10);
  const region = settings.region || 'all';
  const mode = settings.mode || 'mcq';
  const timePerRound = Number(settings.time || 20);

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [isCorrectLocal, setIsCorrectLocal] = useState<boolean | null>(null);
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
    }, 200); // Faster tick for smoothness

    return () => clearInterval(interval);
  }, [timerStartAt, timerSeconds, currentPhase]);

  // Sync Local Answer State
  useEffect(() => {
      if (playerId) {
          const myPlayer = gamePlayers.find((p: any) => p.player_id === playerId);
          if (myPlayer) {
              setHasAnswered(myPlayer.has_answered);
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state for new round
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserAnswer('');
          setIsCorrectLocal(null);
          setScoreEarned(0);
          setHasAnswered(false);
      }
  }, [currentFlag?.code, currentPhase]);

  // --- HOST LOGIC ---
  useEffect(() => {
      if (!isHost || !roomId) return;

      const manageGame = async () => {
          // 1. Playing -> Round Results (Time up or All Answered)
          if (currentPhase === 'playing') {
              // Safety check: ensure round has started for at least 2 seconds before checking "all answered"
              // This prevents race conditions where phase updates before player 'has_answered' reset
              const roundDuration = timerStartAt ? Date.now() - new Date(timerStartAt).getTime() : 0;
              if (roundDuration < 2000) return;

              const allAnswered = players.length > 0 && gamePlayers.filter((p: any) => p.has_answered).length >= players.length;
              const timeIsUp = timeLeft === 0 && timerStartAt && (Date.now() > new Date(timerStartAt).getTime() + timerSeconds * 1000);

              if (allAnswered || timeIsUp) {
                  // Move to Results
                  await supabase.from('flag_games').update({
                      phase: 'round_results',
                      timer_start_at: null // Stop timer
                  }).eq('room_id', roomId);
                  
                  // Auto Next Round after 3s
                  setTimeout(async () => {
                      await nextRound();
                  }, 3000);
              }
          }
      };

      manageGame();
  }, [isHost, roomId, currentPhase, timeLeft, timerStartAt, timerSeconds, players.length, gamePlayers]);

  // --- ACTIONS ---

  const startNewGame = async () => {
      if (!isHost || !roomId) return;

      try {
          toast.loading("Chargement des drapeaux...");
          
          // Fetch flags
          const res = await fetch(`/api/games/flag?count=${totalRounds}&region=${region}&mode=${mode}`);
          if (!res.ok) throw new Error("API Error");
          const questions = await res.json();
          
          if (!questions || questions.length === 0) {
              toast.error("Erreur: Aucun drapeau trouvé");
              return;
          }

          // Setup Game
          const firstFlag = questions[0];
          const queue = questions.slice(1);

          // Reset Players
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              score: 0,
              has_answered: false,
              last_answer: null,
              answer_time_ms: 0
          }));
          
          await supabase.from('flag_players').delete().eq('room_id', roomId);
          await supabase.from('flag_players').insert(playerInserts);

          // Update Game
          await supabase.from('flag_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              region,
              mode,
              timer_seconds: timePerRound,
              timer_start_at: new Date().toISOString(),
              current_flag: firstFlag,
              queue: queue,
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          toast.dismiss();
          toast.success("C'est parti !");

      } catch (e) {
          console.error(e);
          toast.error("Erreur au démarrage");
      }
  };

  const nextRound = async () => {
      if (!isHost || !roomId || !game) return;

      const queue = game.queue || [];
      const currentRound = game.current_round || 1;

      if (queue.length === 0) {
          // Game Over -> Podium
          await supabase.from('flag_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextFlag = queue[0];
      const nextQueue = queue.slice(1);

      // Reset players answered state
      await supabase.from('flag_players').update({
          has_answered: false,
          last_answer: null,
          answer_time_ms: 0
      }).eq('room_id', roomId);

      // Start next round
      await supabase.from('flag_games').update({
          phase: 'playing',
          current_round: currentRound + 1,
          current_flag: nextFlag,
          queue: nextQueue,
          timer_start_at: new Date().toISOString()
      }).eq('room_id', roomId);
  };

  const submitGuess = async (answer: string) => {
      if (!roomId || !playerId || hasAnswered || currentPhase !== 'playing') return;
      if (!currentFlag) return;

      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      
      const userAnswerNorm = normalize(answer);
      const correctAnswerNorm = normalize(currentFlag.name);
      
      // Check correctness (Exact for MCQ, Fuzzy-ish for Text)
      let isCorrect = false;
      if (mode === 'mcq') {
          isCorrect = userAnswerNorm === correctAnswerNorm;
      } else {
          // Fuzzy check
          // 1. Strict Match
          if (userAnswerNorm === correctAnswerNorm) isCorrect = true;
          // 2. Contains (Removed for strictness, unless very long)
          else if (correctAnswerNorm.length > 8 && userAnswerNorm.includes(correctAnswerNorm)) isCorrect = true;
          // 3. Levenshtein (Strict)
          else {
              const dist = levenshteinDistance(userAnswerNorm, correctAnswerNorm);
              // Max 1 error for short, 2 for long
              const threshold = correctAnswerNorm.length > 5 ? 2 : 1;
              if (dist <= threshold) isCorrect = true;
          }
      }

      // Calculate Score
      let score = 0;
      const now = Date.now();
      const start = new Date(timerStartAt).getTime();
      const timeTaken = Math.max(0, now - start); // ms
      
      if (isCorrect) {
          // Max 1000 pts if < 3s (3000ms)
          // Min 200 pts at end of timer
          if (timeTaken <= 3000) {
              score = 1000;
          } else {
              const maxTime = timerSeconds * 1000;
              const factor = 1 - ((timeTaken - 3000) / (maxTime - 3000));
              score = Math.max(200, Math.round(200 + 800 * Math.max(0, factor)));
          }
      }

      // Optimistic update
      setHasAnswered(true);
      setUserAnswer(answer);
      setIsCorrectLocal(isCorrect);
      setScoreEarned(score);
      if (isCorrect) {
          vibrate(HAPTIC.SUCCESS);
          toast.success(`+${score} pts !`);
      } else {
          vibrate(HAPTIC.ERROR);
          toast.error("Raté !");
      }

      // DB Update
      // Get current score first? No, simple increment is better but SQL `score = score + X` is hard via JS client without RPC.
      // We need to fetch current score or trust optimistic?
      // Better: fetch current score of player
      const { data: pData } = await supabase.from('flag_players').select('score').eq('room_id', roomId).eq('player_id', playerId).single();
      const currentScore = pData?.score || 0;

      await supabase.from('flag_players').update({
          score: currentScore + score,
          has_answered: true,
          last_answer: answer,
          answer_time_ms: timeTaken
      }).eq('room_id', roomId).eq('player_id', playerId);
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('flag_games').delete().eq('room_id', roomId);
      await supabase.from('flag_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('flag_games').delete().eq('room_id', roomId);
      await supabase.from('flag_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- UTILS ---
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

  const playersMap = useMemo(() => {
      return players.reduce((acc, p) => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { ...acc, [p.name]: gp?.score || 0 };
      }, {} as Record<string, number>);
  }, [players, gamePlayers]);

  const sortedPlayers = useMemo(() => {
      return [...players].map(p => {
          const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
          return { ...p, score: gp?.score || 0, last_answer: gp?.last_answer };
      }).sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
  }, [players, gamePlayers]);

  // --- RENDER ---
  return (
    <GameLayout
      players={playersMap}
      roundCount={game.current_round || 0}
      maxRounds={game.total_rounds || totalRounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="Flag Guessr"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
      voteToLobby={<VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} />}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
               <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                   <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform rotate-3">
                       <Globe className="w-16 h-16 text-[#06B6D4]" />
                       <Flag className="w-8 h-8 text-accent-secondary absolute -bottom-2 -right-2" />
                   </div>
                   
                   <div className="text-center space-y-2 mb-8">
                       <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">Prêt à voyager ?</h2>
                       <p className="text-tx-secondary font-bold">
                           Région : <span className="text-[#06B6D4] font-black uppercase tracking-widest">{region}</span> • 
                           Mode : <span className="text-accent-primary font-black uppercase tracking-widest">{mode === 'mcq' ? 'QCM' : 'Texte'}</span>
                       </p>
                   </div>

                   {isHost ? (
                       <button 
                           onClick={startNewGame}
                           className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal flex items-center justify-center gap-3"
                       >
                           <Play className="w-6 h-6" /> LANCER LA PARTIE
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

        {/* PHASE: PLAYING / ROUND_RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentFlag && (
            <div className="flex flex-col items-center w-full max-w-2xl gap-6 pt-4 p-4">
                
                {/* FLAG IMAGE */}
                <div className="relative w-full aspect-[16/9] md:aspect-[2/1] bg-brand-inner rounded-[32px] overflow-hidden shadow-brutal border-4 border-brand-border p-4">
                    <Image 
                        src={currentFlag.flagUrl} 
                        alt="Flag" 
                        fill 
                        className="object-contain p-4 drop-shadow-md"
                        priority
                    />
                    
                    {/* OVERLAY RESULT */}
                    {currentPhase === 'round_results' && (
                        <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in z-10 border-4 border-brand-border rounded-[28px] m-1">
                            <h3 className="font-display text-4xl font-black text-tx-base mb-2 text-center uppercase tracking-wider">{currentFlag.name}</h3>
                            <p className="text-tx-secondary font-bold text-lg font-mono uppercase tracking-widest bg-brand-inner px-4 py-1 rounded-lg border-2 border-brand-border">{currentFlag.code}</p>
                        </div>
                    )}
                </div>

                {/* GAME AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full space-y-6 animate-in slide-in-from-bottom-4">
                        {mode === 'mcq' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentFlag.options?.map((option: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => submitGuess(option)}
                                        disabled={hasAnswered}
                                        className={cn(
                                            "h-16 font-display text-lg font-black rounded-2xl transition-all border-4 border-brand-border shadow-brutal",
                                            hasAnswered 
                                                ? userAnswer === option 
                                                    ? 'bg-accent-primary text-brand-bg opacity-100' 
                                                    : 'bg-brand-inner text-tx-muted opacity-50'
                                                : 'bg-brand-inner text-tx-base hover:bg-tx-base hover:text-brand-bg active:translate-y-1 active:shadow-none'
                                        )}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                <input 
                                    placeholder="Nom du pays..." 
                                    value={userAnswer}
                                    onChange={e => setUserAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitGuess(userAnswer)}
                                    disabled={hasAnswered}
                                    className="flex-1 h-16 text-xl bg-brand-inner border-4 border-brand-border focus:border-tx-base text-tx-base placeholder:text-tx-muted text-center rounded-2xl shadow-brutal outline-none font-bold transition-colors disabled:opacity-50"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => submitGuess(userAnswer)}
                                    disabled={hasAnswered || !userAnswer.trim()}
                                    className="h-16 w-32 bg-accent-success hover:bg-tx-base text-brand-bg font-display font-black tracking-wider rounded-2xl shadow-brutal border-4 border-brand-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    VALIDER
                                </button>
                            </div>
                        )}

                        {hasAnswered && (
                            <div className="text-center animate-in fade-in bg-brand-inner border-4 border-brand-border p-4 rounded-2xl shadow-brutal">
                                <p className="font-bold text-tx-secondary uppercase tracking-widest">Réponse enregistrée. En attente des autres...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full bg-brand-card rounded-3xl border-4 border-brand-border overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar shadow-brutal p-2">
                        {sortedPlayers.map((p, idx) => {
                            const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
                            const answered = gp?.has_answered;
                            const isCorrect = gp?.last_answer && (
                                mode === 'mcq' 
                                ? gp.last_answer === currentFlag.name 
                                : levenshteinDistance(gp.last_answer.toLowerCase(), currentFlag.name.toLowerCase()) <= 2
                            );

                            return (
                                <div key={p.id} className="flex items-center justify-between p-4 mb-2 last:mb-0 bg-brand-inner border-2 border-brand-border rounded-xl">
                                    <div className="flex items-center gap-4">
                                        <div className="font-display font-black text-lg text-tx-base">{p.name}</div>
                                        {answered && (
                                            isCorrect 
                                            ? <CheckCircle className="w-6 h-6 text-accent-success" />
                                            : <XCircle className="w-6 h-6 text-accent-secondary" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-bold text-tx-secondary uppercase tracking-widest">{gp?.last_answer || '-'}</span>
                                        <span className="font-display font-black text-[#06B6D4] bg-brand-bg px-3 py-1 rounded-md border-2 border-brand-border">{gp?.score} pts</span>
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
                        <Trophy className="w-16 h-16 text-[#06B6D4]" />
                    </div>
                    <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                    
                    <div className="w-full space-y-4 mb-8">
                        {sortedPlayers.map((p, i) => (
                            <div key={p.id} className={cn(
                                "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                i === 0 ? "bg-accent-primary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                            )}>
                                {/* Badges */}
                                {i === 0 && (
                                    <div className="absolute -top-4 -right-4 bg-[#06B6D4] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                        Globe Trotter
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-4">
                                    <span className={cn(
                                        "w-12 h-12 flex items-center justify-center rounded-xl font-display font-black text-2xl border-2 border-brand-border",
                                        i === 0 ? "bg-[#06B6D4] text-brand-bg" : "bg-brand-bg text-tx-base"
                                    )}>
                                        {i + 1}
                                    </span>
                                    
                                    <div className="flex flex-col text-left">
                                        <span className="text-xl font-display font-black">{p.name}</span>
                                        <span className={cn(
                                            "text-xs font-bold uppercase tracking-widest",
                                            i === 0 ? "text-brand-bg/80" : "text-tx-secondary"
                                        )}>
                                            {i === 0 ? '🌍 Cartographe' : '🧭 Explorateur'}
                                        </span>
                                    </div>
                                </div>
                                <span className={cn(
                                    "text-3xl font-display font-black",
                                    i === 0 ? "text-brand-bg" : "text-[#06B6D4]"
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
