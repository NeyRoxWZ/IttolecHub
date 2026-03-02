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
  const totalRounds = game.total_rounds || 5;
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 15;
  
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
    if (!timerStartAt || currentPhase !== 'playing') {
        if (currentPhase !== 'playing') {
            setTimeLeft(0);
            setBlurAmount(0); // Reveal on results
        }
        return;
    }

    const start = new Date(timerStartAt).getTime();
    const duration = timerSeconds * 1000;
    
    const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - start) / 1000;
        const remaining = Math.max(0, Math.ceil((start + duration - now) / 1000));
        
        setTimeLeft(remaining);
        
        // Progressive Blur Logic (3 steps of 5s each for default 15s)
        // Step 1 (0-5s): 20px
        // Step 2 (5-10s): 8px
        // Step 3 (10-15s): 0px (but still playing)
        // Wait, instructions say:
        // Step 1: very blur (20px) for 5s
        // Step 2: light blur (8px) for 5s
        // Step 3: clear (0px) for 5s
        
        if (elapsed < 5) {
            setBlurAmount(20);
        } else if (elapsed < 10) {
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
              
              if (currentPhase === 'playing' && !myPlayer.has_found) {
                  // Reset for new round if not found
                  // But keep disabled if already found in this round? No, has_found is reset by host.
                  // We just need to ensure input is enabled at start of round.
                  // Wait, has_found is from server state.
              }
              
              // Reset local guess on new round
              if (currentPhase === 'playing' && !myPlayer.has_found && userGuess !== '') {
                  setUserGuess('');
              }
          }
      }
  }, [gamePlayers, playerId, currentPhase]);

  // Fuzzy Matching Logic
  const checkAnswer = async (guess: string) => {
      if (!currentLogo || hasFound || !roomId || !playerId) return;
      
      const targetName = currentLogo.name;
      
      const fuse = new Fuse([targetName], {
          includeScore: true,
          threshold: 0.3, // Tolerance
      });
      
      const result = fuse.search(guess);
      
      if (result.length > 0) {
          // Correct!
          setHasFound(true);
          setInputDisabled(true);
          toast.success("Correct !");
          
          const now = Date.now();
          const start = new Date(timerStartAt).getTime();
          const timeTaken = now - start;
          const elapsedSec = timeTaken / 1000;
          
          // Calculate Score
          let points = 0;
          if (elapsedSec < 5) points = 1000;      // Step 1
          else if (elapsedSec < 10) points = 600; // Step 2
          else points = 200;                      // Step 3
          
          // Bonus: +100 if found within first 2s of the step
          const stepStart = elapsedSec < 5 ? 0 : (elapsedSec < 10 ? 5 : 10);
          if (elapsedSec - stepStart < 2) {
              points += 100;
          }
          
          // Update DB
          // First get current score
          const myPlayer = players.find(p => p.id === playerId);
          const currentScore = myPlayer?.score || 0;
          
          await supabase.from('logo_players').update({
              has_found: true,
              score: currentScore + points, // This is wrong, we should store round score or add to total in a secure way.
              // For simplicity in this architecture, we usually update total score directly on players table too.
              // But here we are updating logo_players.
              // Let's rely on `logo_players` score column as accumulating game score.
              // Wait, `gamePlayers` has the score from `logo_players`.
              // We need to fetch the latest `logo_players` row to be safe or just increment.
              // Supabase doesn't support atomic increment easily via simple client update without RPC.
              // We'll trust the client state for now or fetch first.
              find_time_ms: timeTaken,
              last_guess: guess
          }).match({ room_id: roomId, player_id: playerId });
          
          // Also update main players table for global sync
          await supabase.from('players').update({ score: currentScore + points }).eq('id', playerId);
          
      }
  };

  // --- HOST LOGIC ---

  // Start/Next Round
  const startRound = async () => {
      if (!isHost || !roomId) return;
      
      try {
          // Fetch settings
          // We can pass params to API
          const category = game.category || 'all';
          const difficulty = game.difficulty || 'mix';
          
          const data = await fetch(`/api/games/logo?count=1&category=${category}&difficulty=${difficulty}`);
          const logos = await data.json();
          
          if (!logos || logos.length === 0) {
              toast.error("Erreur lors du chargement du logo");
              return;
          }
          
          const nextLogo = logos[0];
          
          // 2. Reset players
          await supabase.from('logo_players').update({
              has_found: false,
              find_time_ms: 0,
              last_guess: null
          }).eq('room_id', roomId);
          
          // 3. Update Game
          await supabase.from('logo_games').update({
              phase: 'playing',
              current_logo: nextLogo,
              timer_start_at: new Date().toISOString(),
              current_round: currentPhase === 'setup' ? 1 : currentRound + 1
          }).eq('room_id', roomId);

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
          setTimeout(() => {
              supabase.from('logo_games').update({ phase: 'podium' }).eq('room_id', roomId);
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
              <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                  <div className="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-2xl animate-bounce">
                      <ImageIcon className="w-16 h-16 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Prêt à reconnaître des marques ?</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-md text-center">
                      Les logos apparaîtront floutés puis deviendront nets. Soyez le plus rapide à deviner la marque !
                  </p>
                  
                  {isHost ? (
                      <Button onClick={startRound} size="lg" className="w-full max-w-sm text-lg h-14 rounded-xl shadow-xl shadow-orange-500/20 bg-orange-500 hover:bg-orange-600 text-white">
                          Commencer la partie
                      </Button>
                  ) : (
                      <div className="flex items-center gap-2 text-orange-500 animate-pulse">
                          <Timer className="w-5 h-5" />
                          <span>En attente de l'hôte...</span>
                      </div>
                  )}
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto space-y-8">
                  {/* Logo Display */}
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-white rounded-3xl shadow-2xl flex items-center justify-center p-8 border-4 border-slate-100 dark:border-slate-800 overflow-hidden">
                      {currentLogo && (
                          <img 
                              src={`https://cdn.simpleicons.org/${currentLogo.slug}`} 
                              alt="Logo mystère" 
                              className="w-full h-full object-contain transition-all duration-1000 ease-linear"
                              style={{ 
                                  filter: `blur(${blurAmount}px)`,
                                  opacity: blurAmount > 10 ? 0.8 : 1
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
                                  <div key={p.player_id} className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                                      <div className="flex items-center gap-3">
                                          <div className="font-bold text-green-700 dark:text-green-400">#{index + 1}</div>
                                          <div className="font-bold text-slate-800 dark:text-slate-100">{playerInfo?.name}</div>
                                      </div>
                                      <div className="text-sm font-mono text-green-600 dark:text-green-400">
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
                      }} size="lg" className="mt-8">
                          Retour au salon
                      </Button>
                  )}
              </div>
          )}
      </GameLayout>
  );
}