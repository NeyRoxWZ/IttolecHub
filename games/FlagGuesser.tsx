'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, XCircle, Clock, Flag, Loader2, Home, LogOut, ArrowRight, Play, Globe } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
    }, 200); // Faster tick for smoothness

    return () => clearInterval(interval);
  }, [timerStartAt, timerSeconds, currentPhase]);

  // Sync Local Answer State
  useEffect(() => {
      if (playerId) {
          const myPlayer = gamePlayers.find((p: any) => p.player_id === playerId);
          if (myPlayer) {
              setHasAnswered(myPlayer.has_answered);
              if (currentPhase === 'playing' && !myPlayer.has_answered) {
                  // Reset local state for new round
                  setUserAnswer('');
                  setIsCorrectLocal(null);
                  setScoreEarned(0);
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
      router.push(`/room/${roomCode}`);
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
      }).sort((a, b) => b.score - a.score);
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
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-in fade-in">
               <div className="relative">
                   <Globe className="w-24 h-24 text-blue-500 animate-pulse" />
                   <Flag className="w-12 h-12 text-red-500 absolute -bottom-2 -right-2" />
               </div>
               
               <div className="text-center space-y-2">
                   <h2 className="text-3xl font-bold text-white">Prêt à voyager ?</h2>
                   <p className="text-gray-400">
                       Région : <span className="text-blue-400 font-bold uppercase">{region}</span> • 
                       Mode : <span className="text-purple-400 font-bold uppercase">{mode === 'mcq' ? 'QCM' : 'Texte'}</span>
                   </p>
               </div>

               {isHost ? (
                   <Button 
                       size="lg" 
                       onClick={startNewGame}
                       className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/20 rounded-xl"
                   >
                       <Play className="w-6 h-6 mr-2" /> Lancer la partie
                   </Button>
               ) : (
                   <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full">
                       <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                       <span className="text-gray-300">En attente de l'hôte...</span>
                   </div>
               )}
            </div>
        )}

        {/* PHASE: PLAYING / ROUND_RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentFlag && (
            <div className="flex flex-col items-center w-full max-w-2xl gap-6 pt-4">
                
                {/* FLAG IMAGE */}
                <div className="relative w-full aspect-[16/9] md:aspect-[2/1] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                    <Image 
                        src={currentFlag.flagUrl} 
                        alt="Flag" 
                        fill 
                        className="object-contain p-4"
                        priority
                    />
                    
                    {/* OVERLAY RESULT */}
                    {currentPhase === 'round_results' && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in z-10">
                            <h3 className="text-3xl font-black text-white mb-2 text-center drop-shadow-lg">{currentFlag.name}</h3>
                            <p className="text-blue-300 font-bold uppercase tracking-widest">{currentFlag.code}</p>
                        </div>
                    )}
                </div>

                {/* GAME AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full space-y-6 animate-in slide-in-from-bottom-4">
                        {mode === 'mcq' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentFlag.options?.map((option: string, idx: number) => (
                                    <Button
                                        key={idx}
                                        onClick={() => submitGuess(option)}
                                        disabled={hasAnswered}
                                        className={`h-16 text-lg font-bold rounded-xl transition-all ${
                                            hasAnswered 
                                                ? userAnswer === option 
                                                    ? 'bg-slate-600 opacity-50' 
                                                    : 'bg-slate-800 opacity-30'
                                                : 'bg-slate-800 hover:bg-slate-700 hover:scale-[1.02]'
                                        }`}
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Nom du pays..." 
                                    value={userAnswer}
                                    onChange={e => setUserAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitGuess(userAnswer)}
                                    disabled={hasAnswered}
                                    className="h-14 text-lg bg-slate-800 border-white/10"
                                    autoFocus
                                />
                                <Button 
                                    onClick={() => submitGuess(userAnswer)}
                                    disabled={hasAnswered || !userAnswer.trim()}
                                    className="h-14 px-6 bg-blue-600 hover:bg-blue-500 font-bold"
                                >
                                    Valider
                                </Button>
                            </div>
                        )}

                        {hasAnswered && (
                            <div className="text-center animate-in fade-in">
                                <p className="text-gray-400 italic">Réponse enregistrée. Attendez les autres...</p>
                            </div>
                        )}
                    </div>
                )}

                {/* RESULTS LIST */}
                {currentPhase === 'round_results' && (
                    <div className="w-full bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                        {sortedPlayers.map((p, idx) => {
                            const gp = gamePlayers.find((gp: any) => gp.player_id === p.id);
                            const answered = gp?.has_answered;
                            // Need to check if correct? We don't store "is_correct" in DB, but we can re-verify or assume score increase implies correct?
                            // Actually, score increase is the only way to know if correct from DB if we don't store bool.
                            // But we can check `last_answer` against `currentFlag.name`.
                            const isCorrect = gp?.last_answer && (
                                mode === 'mcq' 
                                ? gp.last_answer === currentFlag.name 
                                : levenshteinDistance(gp.last_answer.toLowerCase(), currentFlag.name.toLowerCase()) <= 2
                            );

                            return (
                                <div key={p.id} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-white">{p.name}</div>
                                        {answered && (
                                            isCorrect 
                                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                                            : <XCircle className="w-4 h-4 text-red-500" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-400">{gp?.last_answer || '-'}</span>
                                        <span className="font-mono font-bold text-blue-400">{gp?.score} pts</span>
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
                
                <div className="w-full space-y-4 mb-8">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`relative flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
                            i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)] scale-105 z-10' : 
                            i === 1 ? 'bg-slate-800/50 border-slate-600' : 
                            i === 2 ? 'bg-slate-800/30 border-slate-700' : 'opacity-60 border-transparent'
                        }`}>
                            {/* Badges */}
                            {i === 0 && (
                                <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg transform rotate-12">
                                    Globe Trotter
                                </div>
                            )}
                            
                            <div className="flex items-center gap-4">
                                <span className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-xl ${
                                    i === 0 ? 'bg-yellow-500 text-black' : 
                                    i === 1 ? 'bg-slate-400 text-slate-900' :
                                    i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-500'
                                }`}>{i + 1}</span>
                                
                                <div className="flex flex-col">
                                    <span className="text-xl font-bold text-white">{p.name}</span>
                                    <span className="text-xs text-slate-400 font-medium">
                                        {i === 0 ? '🌍 Cartographe' : '🧭 Explorateur'}
                                    </span>
                                </div>
                            </div>
                            <span className="text-3xl font-mono font-black text-blue-400">{p.score}</span>
                        </div>
                    ))}
                </div>

                {isHost && (
                    <Button onClick={returnToLobby} size="lg" className="bg-slate-700 hover:bg-slate-600 font-bold">
                        Retour au salon
                    </Button>
                )}
            </div>
        )}

      </div>
    </GameLayout>
  );
}
