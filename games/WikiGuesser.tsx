'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, CheckCircle, Clock, BookOpen, Loader2, Home, Send, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { vibrate, HAPTIC } from '@/lib/haptic';

interface WikiGuesserProps {
  roomCode: string;
}

export default function WikiGuesser({ roomCode }: WikiGuesserProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    wiki,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'wiki');

  // --- DERIVED STATE ---
  const game = wiki?.game || {};
  const gamePlayers = wiki?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentArticle = game.current_article;
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 60;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  // category is not fully supported by API but we keep it in settings
  const timePerRound = Number(settings.time || 60);

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hasFound, setHasFound] = useState(false);
  const [findRank, setFindRank] = useState(0);
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
              setHasFound(myPlayer.has_found);
              setFindRank(myPlayer.find_rank);
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state on new round (when article changes)
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserAnswer('');
          setScoreEarned(0);
          setHasFound(false);
          setFindRank(0);
      }
  }, [currentArticle?.title, currentPhase]);

  // --- HOST LOGIC ---
  useEffect(() => {
      if (!isHost || !roomId) return;

      const manageGame = async () => {
          // 1. Playing -> Round Results (Time up)
          if (currentPhase === 'playing') {
              const timeIsUp = timeLeft === 0 && timerStartAt && (Date.now() > new Date(timerStartAt).getTime() + timerSeconds * 1000);
              const allFound = players.length > 0 && gamePlayers.filter((p: any) => p.has_found).length >= players.length;

              if (timeIsUp || allFound) {
                  // Move to Results
                  await supabase.from('wiki_games').update({
                      phase: 'round_results',
                      timer_start_at: null
                  }).eq('room_id', roomId);
                  
                  // Auto Next Round after 5s (longer for reading)
                  setTimeout(async () => {
                      await nextRound();
                  }, 5000);
              }
          }
      };

      manageGame();
  }, [isHost, roomId, currentPhase, timeLeft, timerStartAt, timerSeconds, players.length, gamePlayers]);

  // --- ACTIONS ---

  const startNewGame = async () => {
      if (!isHost || !roomId) return;

      try {
          toast.loading("Chargement de l'encyclopédie...");
          
          // Fetch articles
          const res = await fetch(`/api/games/wiki?count=${totalRounds + 2}`); // Fetch extra just in case
          if (!res.ok) throw new Error("API Error");
          const articles = await res.json();
          
          if (!articles || articles.length === 0) {
              toast.error("Erreur: Aucun article trouvé");
              return;
          }

          // Setup Game
          const firstArticle = articles[0];
          const queue = articles.slice(1); // Store remaining in current_article (no, we need a queue column or just store array in jsonb)
          // We can abuse current_article to store the queue if we want, or add a queue column.
          // Since I can't add columns easily without migration script and I already added one for FlagGuessr...
          // I added `queue` column to `flag_games` but NOT `wiki_games`.
          // Wait, I created `wiki_games` in `supabase_wikiguessr.sql`.
          // Did I add `queue` column?
          // Checking my memory/logs...
          // `create table if not exists wiki_games ... current_article jsonb ...`
          // I did NOT add a `queue` column to `wiki_games`.
          // CRITICAL: I need to store the queue somewhere.
          // I can store it in `current_article` as a property `queue`?
          // `current_article` is jsonb.
          // So structure: { ...articleData, queue: [nextArticles] }
          
          const gamePayload = {
              ...firstArticle,
              queue: queue
          };

          // Reset Players
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              score: 0,
              has_found: false,
              find_rank: 0,
              find_time_ms: 0
          }));
          
          await supabase.from('wiki_players').delete().eq('room_id', roomId);
          await supabase.from('wiki_players').insert(playerInserts);

          // Update Game
          await supabase.from('wiki_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              timer_seconds: timePerRound,
              timer_start_at: new Date().toISOString(),
              current_article: gamePayload,
              found_count: 0,
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
      if (!isHost || !roomId || !currentArticle) return;

      const queue = currentArticle.queue || [];
      const currentRound = game.current_round || 1;

      if (queue.length === 0 || currentRound >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('wiki_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextArticle = queue[0];
      const nextQueue = queue.slice(1);
      
      const gamePayload = {
          ...nextArticle,
          queue: nextQueue
      };

      // Reset players found state
      await supabase.from('wiki_players').update({
          has_found: false,
          find_rank: 0,
          find_time_ms: 0
      }).eq('room_id', roomId);

      // Start next round
      await supabase.from('wiki_games').update({
          phase: 'playing',
          current_round: currentRound + 1,
          current_article: gamePayload,
          timer_start_at: new Date().toISOString(),
          found_count: 0
      }).eq('room_id', roomId);
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasFound || currentPhase !== 'playing') return;
      if (!currentArticle) return;

      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      
      const userAnswerNorm = normalize(userAnswer);
      const correctAnswerNorm = normalize(currentArticle.title);
      
      if (userAnswerNorm.length < 2) return; // Prevent 1 char guesses

      // Fuzzy Check (Levenshtein)
      // Allow typos: 2 for long words, 1 for short
      const dist = levenshteinDistance(userAnswerNorm, correctAnswerNorm);
      const threshold = correctAnswerNorm.length > 5 ? 2 : 1;
      
      // Strict Logic: Only Levenshtein close match OR exact inclusion for very long titles
      // Removed generic inclusion check which was too lenient
      const isCorrect = dist <= threshold;

      if (isCorrect) {
          // Calculate Score
          // 1st: 1000, 2nd: 700, 3rd: 400, Others: 200
          // Bonus: +200 if < 10s
          
          const now = Date.now();
          const start = new Date(timerStartAt).getTime();
          const timeTaken = Math.max(0, now - start); // ms
          
          // Get current rank (optimistic but we verify against DB count)
          // We need to fetch current found_count from DB to be safe-ish
          const { count } = await supabase.from('wiki_players').select('*', { count: 'exact', head: true }).eq('room_id', roomId).eq('has_found', true);
          const rank = (count || 0) + 1;
          
          let baseScore = 200;
          if (rank === 1) baseScore = 1000;
          else if (rank === 2) baseScore = 700;
          else if (rank === 3) baseScore = 400;
          
          let bonus = 0;
          if (timeTaken <= 10000) bonus = 200;
          
          const totalScore = baseScore + bonus;

          // Update Local
          setHasFound(true);
          setFindRank(rank);
          setScoreEarned(totalScore);
          vibrate(HAPTIC.SUCCESS);
          toast.success(`Trouvé ! +${totalScore} pts`);

          // Update DB
          // Fetch current score first
          const { data: pData } = await supabase.from('wiki_players').select('score').eq('room_id', roomId).eq('player_id', playerId).single();
          const currentScore = pData?.score || 0;

          await supabase.from('wiki_players').update({
              score: currentScore + totalScore,
              has_found: true,
              find_rank: rank,
              find_time_ms: timeTaken
          }).eq('room_id', roomId).eq('player_id', playerId);
          
          // Increment found_count in game
          // We don't strictly need to increment `found_count` column if we count rows, but let's do it for completeness if we used it.
          // Actually we used `count(*)` so we are good.
      } else {
          vibrate(HAPTIC.ERROR);
          toast.error("Ce n'est pas ça...");
          // Shake effect?
      }
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('wiki_games').delete().eq('room_id', roomId);
      await supabase.from('wiki_players').delete().eq('room_id', roomId);
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
          return { 
              ...p, 
              score: gp?.score || 0, 
              has_found: gp?.has_found,
              find_rank: gp?.find_rank,
              find_time_ms: gp?.find_time_ms
          };
      }).sort((a, b) => b.score - a.score);
  }, [players, gamePlayers]);

  // --- RENDER ---
  return (
    <GameLayout
      players={playersMap}
      roundCount={game.current_round || 0}
      maxRounds={game.total_rounds || totalRounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="WikiGuessr"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)]">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-in fade-in">
               <div className="relative">
                   <BookOpen className="w-24 h-24 text-slate-400 animate-pulse" />
               </div>
               
               <div className="text-center space-y-2">
                   <h2 className="text-3xl font-bold text-white">Encyclopédie prête ?</h2>
                   <p className="text-gray-400">
                       Rounds : <span className="text-blue-400 font-bold">{totalRounds}</span> • 
                       Temps : <span className="text-purple-400 font-bold">{timePerRound}s</span>
                   </p>
               </div>

               {isHost ? (
                   <Button 
                       size="lg" 
                       onClick={startNewGame}
                       className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-500 hover:to-slate-700 shadow-lg border border-white/10 rounded-xl"
                   >
                       Lancer la partie
                   </Button>
               ) : (
                   <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full">
                       <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                       <span className="text-gray-300">En attente de l'hôte...</span>
                   </div>
               )}
            </div>
        )}

        {/* PHASE: PLAYING / ROUND_RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && currentArticle && (
            <div className="flex flex-col items-center w-full max-w-3xl gap-6 pt-4 px-4">
                
                {/* ARTICLE CARD */}
                <div className="w-full bg-slate-100 text-slate-900 rounded-sm shadow-2xl overflow-hidden relative font-serif">
                    <div className="h-4 bg-slate-300 w-full border-b border-slate-400" />
                    <div className="p-8">
                        {currentPhase === 'round_results' ? (
                            <h2 className="text-3xl font-bold mb-4 border-b pb-2 border-slate-300 flex items-center gap-3 animate-in fade-in">
                                {currentArticle.title}
                                <a href={`https://fr.wikipedia.org/wiki/${currentArticle.title}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                    <ExternalLink className="w-5 h-5" />
                                </a>
                            </h2>
                        ) : (
                            <h2 className="text-3xl font-bold mb-4 border-b pb-2 border-slate-300 text-slate-300 bg-slate-300 select-none blur-sm">
                                {currentArticle.title}
                            </h2>
                        )}

                        <p className="text-lg leading-relaxed whitespace-pre-wrap">
                            {currentPhase === 'round_results' ? currentArticle.extract_original : currentArticle.extract_obfuscated}
                        </p>
                    </div>
                </div>

                {/* INPUT AREA */}
                {currentPhase === 'playing' && (
                    <div className="w-full max-w-xl animate-in slide-in-from-bottom-4">
                        {hasFound ? (
                            <div className="bg-green-600 text-white p-4 rounded-xl text-center font-bold text-xl shadow-lg flex items-center justify-center gap-3 animate-bounce">
                                <CheckCircle className="w-8 h-8" />
                                Trouvé ! ({findRank}{findRank === 1 ? 'er' : 'ème'})
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="Qui/Quoi est-ce ?" 
                                    value={userAnswer}
                                    onChange={e => setUserAnswer(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && submitGuess()}
                                    className="h-14 text-lg bg-slate-900 border-white/20 text-white placeholder:text-gray-500"
                                    autoFocus
                                />
                                <Button 
                                    onClick={submitGuess}
                                    disabled={!userAnswer.trim()}
                                    className="h-14 px-8 bg-blue-600 hover:bg-blue-500 font-bold"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* FOUND LIST (Realtime) */}
                <div className="w-full flex flex-wrap justify-center gap-2">
                    {sortedPlayers.filter(p => p.has_found).map(p => (
                        <div key={p.id} className="bg-green-500/20 border border-green-500/50 text-green-400 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 animate-in zoom-in">
                            <CheckCircle className="w-3 h-3" /> {p.name}
                        </div>
                    ))}
                </div>
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
                                    Grand Sage
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
                                        {i === 0 ? '🧠 Encyclopédie Vivante' : '📚 Lecteur'}
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
