'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Timer, CheckCircle, XCircle, Trophy, Eye, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { vibrate, HAPTIC } from '@/lib/haptic';

interface LogoGuessrProps {
  roomCode: string;
}

export default function LogoGuessr({ roomCode }: LogoGuessrProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    logo,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'logo');

  // --- DERIVED STATE ---
  const game = logo?.game || {};
  const gamePlayers = logo?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentLogo = game.current_logo;
  const currentRound = game.current_round || 1;
  const timerStartAt = game.timer_start_at;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  const timerSeconds = Number(settings.time || 15);
  const category = settings.category || 'all';
  const difficulty = settings.difficulty || 'mix';

  // Players Map for GameLayout
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => {
        acc[p.name] = p.score;
        return acc;
    }, {} as Record<string, number>);
  }, [players]);

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userGuess, setUserGuess] = useState('');
  const [hasFound, setHasFound] = useState(false);
  const [blurAmount, setBlurAmount] = useState(20);
  const [inputDisabled, setInputDisabled] = useState(false);

  // --- EFFECTS ---

  // Return to Lobby Broadcast
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}`);
    }
  }, [lastEvent, roomCode, router]);

  // Timer & Blur Logic
  useEffect(() => {
    // Initial blur for setup/playing
    if (currentPhase === 'playing') {
        // Ensure blur starts high
        if (timeLeft > timerSeconds * 0.66) {
            setBlurAmount(20);
        }
    } else if (currentPhase === 'setup') {
        setBlurAmount(0);
    } else {
        setBlurAmount(0);
    }

    if (!timerStartAt || currentPhase !== 'playing') {
        if (currentPhase !== 'playing') {
            setTimeLeft(0);
            setBlurAmount(0); // Reveal on results
        }
        return;
    }

    const start = new Date(timerStartAt).getTime();
    const duration = timerSeconds * 1000;
    
    // Calculate steps based on duration
    const stepDuration = duration / 3;

    const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - start);
        const remaining = Math.max(0, Math.ceil((start + duration - now) / 1000));
        
        setTimeLeft(remaining);
        
        // Progressive Blur Logic
        if (elapsed < stepDuration) {
            setBlurAmount(20);
        } else if (elapsed < stepDuration * 2) {
            setBlurAmount(8);
        } else {
            setBlurAmount(0);
        }
        
        if (remaining <= 0) {
            clearInterval(interval);
        }
    }, 100);

    return () => clearInterval(interval);
  }, [timerStartAt, timerSeconds, currentPhase]);

  // Sync Local Player State
  useEffect(() => {
      if (playerId) {
          const myPlayer = gamePlayers.find((p: any) => p.player_id === playerId);
          if (myPlayer) {
              setHasFound(myPlayer.has_found);
              setInputDisabled(myPlayer.has_found);
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state on new round
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserGuess('');
          setHasFound(false);
          setInputDisabled(false);
      }
  }, [currentLogo?.id, currentPhase]);

  // Matching Logic (Strict Levenshtein)
  const checkAnswer = async (guess: string) => {
      if (!currentLogo || hasFound || !roomId || !playerId) return;
      
      const targetName = currentLogo.name.toLowerCase().trim();
      const userGuessNormalized = guess.toLowerCase().trim();
      
      // 1. Strict Exact Match
      if (userGuessNormalized === targetName) {
          handleCorrectAnswer(guess);
          return;
      }

      // 2. Levenshtein Distance for typos
      // Allow max 1 error for short words (<5 chars), 2 for longer
      const maxDistance = targetName.length < 5 ? 1 : 2;
      const distance = levenshteinDistance(userGuessNormalized, targetName);
      
      if (distance <= maxDistance) {
          handleCorrectAnswer(guess);
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

  const handleCorrectAnswer = async (guess: string) => {
      setHasFound(true);
      setInputDisabled(true);
      vibrate(HAPTIC.SUCCESS);
      toast.success("Correct !");
      
      const now = Date.now();
      const start = new Date(timerStartAt).getTime();
      const timeTaken = now - start;
      const duration = timerSeconds * 1000;
      const stepDuration = duration / 3;
      
      // Calculate Score
      let points = 0;
      if (timeTaken < stepDuration) points = 1000;      // Step 1
      else if (timeTaken < stepDuration * 2) points = 600; // Step 2
      else points = 200;                      // Step 3
      
      // Bonus: +100 if found within first 2s of the step
      const currentStepStart = Math.floor(timeTaken / stepDuration) * stepDuration;
      if (timeTaken - currentStepStart < 2000) {
          points += 100;
      }
      
      // Update DB
      const myPlayer = players.find(p => p.id === playerId);
      const currentScore = myPlayer?.score || 0;
      
      await supabase.from('logo_players').update({
          has_found: true,
          score: currentScore + points,
          find_time_ms: timeTaken,
          last_guess: guess
      }).match({ room_id: roomId, player_id: playerId });
      
      // Also update main players table for global sync
      await supabase.from('players').update({ score: currentScore + points }).eq('id', playerId);
  };

  // --- HOST LOGIC ---

  // Start/Next Round
  const startRound = async () => {
      if (!isHost || !roomId) return;
      
      try {
          // Fetch settings for API
          const categoryParam = settings.category || 'all';
          const difficultyParam = settings.difficulty || 'mix';
          
          const data = await fetch(`/api/games/logo?count=1&category=${categoryParam}&difficulty=${difficultyParam}`);
          const logos = await data.json();
          
          if (!logos || logos.length === 0) {
              toast.error("Erreur lors du chargement du logo");
              return;
          }
          
          const nextLogo = logos[0];
          
          // 1. Initial Setup if needed
          if (currentPhase === 'setup') {
               // Initialize players
               const playerInserts = players.map(p => ({
                  room_id: roomId,
                  player_id: p.id,
                  score: 0,
                  has_found: false,
                  find_time_ms: 0
              }));
              
              await supabase.from('logo_players').delete().eq('room_id', roomId);
              await supabase.from('logo_players').insert(playerInserts);

              // Create Game Entry
              await supabase.from('logo_games').upsert({
                  room_id: roomId,
                  phase: 'playing',
                  current_round: 1,
                  total_rounds: totalRounds,
                  timer_seconds: timerSeconds,
                  category: categoryParam,
                  difficulty: difficultyParam,
                  current_logo: nextLogo,
                  timer_start_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
              }, { onConflict: 'room_id' });
              
              await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          } else {
              // Next Round
              await supabase.from('logo_players').update({
                  has_found: false,
                  find_time_ms: 0,
                  last_guess: null
              }).eq('room_id', roomId);
              
              await supabase.from('logo_games').update({
                  phase: 'playing',
                  current_logo: nextLogo,
                  timer_start_at: new Date().toISOString(),
                  current_round: currentRound + 1
              }).eq('room_id', roomId);
          }

      } catch (error) {
          console.error("Start Round Error:", error);
          toast.error("Erreur lors du lancement de la manche");
      }
  };

  // End Round
  const endRound = async () => {
      if (!isHost || !roomId) return;
      
      await supabase.from('logo_games').update({
          phase: 'round_results'
      }).eq('room_id', roomId);
      
      if (currentRound < totalRounds) {
          setTimeout(() => startRound(), 3000);
      } else {
          setTimeout(async () => {
              await supabase.from('logo_games').update({ phase: 'podium' }).eq('room_id', roomId);
          }, 3000);
      }
  };

  // Monitor Game State (Host)
  useEffect(() => {
      if (!isHost || currentPhase !== 'playing' || !timerStartAt) return;
      
      const checkEnd = () => {
          const now = Date.now();
          const start = new Date(timerStartAt).getTime();
          const duration = timerSeconds * 1000;
          
          const timeIsUp = now >= start + duration + 1000; 
          const allFound = gamePlayers.length > 0 && gamePlayers.every((p: any) => p.has_found);
          
          if (timeIsUp || allFound) {
              endRound();
          }
      };
      
      const interval = setInterval(checkEnd, 500);
      return () => clearInterval(interval);
  }, [isHost, currentPhase, timerStartAt, timerSeconds, gamePlayers]);

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('logo_games').delete().eq('room_id', roomId);
      await supabase.from('logo_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}`);
  };

  // --- RENDER ---
  
  return (
      <GameLayout
          gameTitle="LogoGuessr"
          roundCount={currentRound}
          maxRounds={totalRounds}
          timer={timeLeft.toString()}
          players={playersMap}
          timeLeft={timeLeft}
      >
          {/* Setup Phase */}
          {currentPhase === 'setup' && (
              <div className="flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                      <ImageIcon className="w-24 h-24 text-orange-400" />
                  </div>
                  
                  <div className="text-center space-y-4 max-w-lg">
                      <h2 className="text-4xl font-black text-[#F8FAFC] uppercase tracking-wider drop-shadow-lg">
                          Logo <span className="text-orange-400">Guessr</span>
                      </h2>
                      <p className="text-[#94A3B8] text-lg">
                          Les logos apparaîtront floutés puis deviendront nets. Soyez le plus rapide à deviner la marque !
                      </p>
                  </div>
                  
                  {isHost ? (
                      <Button 
                          onClick={startRound} 
                          size="lg" 
                          className="w-full max-w-xs h-16 text-xl bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-wider rounded-xl shadow-[0_4px_0_0px_#020617] transition-all hover:scale-105"
                      >
                          Commencer la partie
                      </Button>
                  ) : (
                      <div className="flex items-center gap-3 bg-[#334155] px-6 py-3 rounded-full border border-[#475569]">
                          <Timer className="w-5 h-5 animate-spin text-orange-400" />
                          <span className="text-[#F8FAFC] font-medium">En attente de l'hôte...</span>
                      </div>
                  )}
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto space-y-8">
                  {/* Logo Display */}
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-[#1E293B] rounded-3xl shadow-2xl flex items-center justify-center p-8 border-4 border-[#334155] overflow-hidden min-h-[16rem]">
                      {currentLogo && (
                          <img 
                              key={currentLogo.slug || currentRound}
                              src={`https://cdn.simpleicons.org/${currentLogo.slug}`} 
                              alt="Logo mystère" 
                              draggable={false}
                              loading="eager"
                              width={320}
                              height={320}
                              onContextMenu={(e) => e.preventDefault()}
                              className={`w-full h-full object-contain select-none ${blurAmount >= 20 ? '' : 'transition-all duration-1000 ease-linear'}`}
                              style={{ 
                                  filter: `blur(${blurAmount}px) brightness(0) grayscale(100%)`,
                                  opacity: 1
                              }}
                          />
                      )}
                      
                      {/* Difficulty Badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                          {currentLogo?.difficulty}
                      </div>
                  </div>

                  {/* Input Area */}
                  <div className="w-full space-y-4">
                      <div className="relative">
                          <Input
                              type="text"
                              value={userGuess}
                              onChange={(e) => {
                                  setUserGuess(e.target.value);
                                  checkAnswer(e.target.value);
                              }}
                              disabled={inputDisabled}
                              placeholder={hasFound ? "Bravo ! Vous avez trouvé." : "Tapez le nom de la marque..."}
                              className={`h-16 text-2xl font-bold text-center rounded-2xl border-2 transition-all ${
                                  hasFound 
                                  ? 'bg-green-100 border-green-500 text-green-700 placeholder:text-green-600' 
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                              }`}
                              autoFocus
                          />
                          {hasFound && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600 animate-in zoom-in">
                                  <CheckCircle className="w-8 h-8" />
                              </div>
                          )}
                      </div>
                      
                      <div className="text-center text-sm text-slate-400">
                          {hasFound ? (
                              <span className="text-green-500 font-bold">Marque trouvée !</span>
                          ) : (
                              <span>Devinez la marque le plus vite possible !</span>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* Round Results Phase */}
          {currentPhase === 'round_results' && (
              <div className="flex flex-col items-center justify-center h-full w-full space-y-8 animate-in zoom-in">
                  <div className="w-48 h-48 bg-white rounded-3xl shadow-2xl flex items-center justify-center p-6 border-4 border-green-500">
                      <img 
                          src={`https://cdn.simpleicons.org/${currentLogo?.slug}`} 
                          alt="Logo" 
                          className="w-full h-full object-contain"
                      />
                  </div>
                  
                  <div className="text-center space-y-2">
                      <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          {currentLogo?.name}
                      </h2>
                      <p className="text-slate-500 font-medium">{currentLogo?.sector}</p>
                  </div>

                  {/* Winners List */}
                  <div className="w-full max-w-md space-y-2">
                      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">Joueurs ayant trouvé</h3>
                      {gamePlayers
                          .filter((p: any) => p.has_found)
                          .sort((a: any, b: any) => a.find_time_ms - b.find_time_ms)
                          .map((p: any, index: number) => {
                              const playerInfo = players.find(pl => pl.id === p.player_id);
                              return (
                                  <div key={p.player_id} className="flex items-center justify-between bg-green-900/20 p-3 rounded-xl border border-green-800">
                                      <div className="flex items-center gap-3">
                                          <div className="font-bold text-green-400">#{index + 1}</div>
                                          <div className="font-bold text-slate-100">{playerInfo?.name}</div>
                                      </div>
                                      <div className="text-sm font-mono text-green-400">
                                          {(p.find_time_ms / 1000).toFixed(2)}s
                                      </div>
                                  </div>
                              );
                          })}
                      {gamePlayers.filter((p: any) => p.has_found).length === 0 && (
                          <div className="text-center text-slate-400 italic">Personne n'a trouvé...</div>
                      )}
                  </div>
              </div>
          )}

          {/* Podium Phase */}
          {currentPhase === 'podium' && (
              <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                  <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                  <h2 className="text-4xl font-black text-[#F8FAFC] mb-8">Classement Final</h2>
                  
                  <div className="w-full space-y-4 mb-8">
                      {players.sort((a, b) => b.score - a.score).map((p, i) => (
                          <div key={p.id} className={`relative flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
                              i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)] scale-105 z-10' : 
                              i === 1 ? 'bg-[#1E293B] border-[#475569]' : 
                              i === 2 ? 'bg-[#1E293B]/70 border-[#334155]' : 'opacity-60 border-transparent'
                          }`}>
                              {/* Badges */}
                              {i === 0 && (
                                  <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg transform rotate-12">
                                      Expert Marketing
                                  </div>
                              )}
                              
                              <div className="flex items-center gap-4">
                                  <span className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-xl ${
                                      i === 0 ? 'bg-yellow-500 text-black' : 
                                      i === 1 ? 'bg-[#475569] text-[#F8FAFC]' :
                                      i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-[#334155] text-[#94A3B8]'
                                  }`}>{i + 1}</span>
                                  
                                  <div className="flex flex-col">
                                      <span className="text-xl font-bold text-[#F8FAFC]">{p.name}</span>
                                      <span className="text-xs text-slate-400 font-medium">
                                          {i === 0 ? '🦅 Œil de Lynx' : '📺 Consommateur'}
                                      </span>
                                  </div>
                              </div>
                              <span className="text-3xl font-mono font-black text-orange-400">{p.score}</span>
                          </div>
                      ))}
                  </div>
                  
                  {isHost && (
                      <Button onClick={returnToLobby} size="lg" variant="secondary" className="font-bold">
                          Retour au salon
                      </Button>
                  )}
              </div>
          )}
      </GameLayout>
  );
}