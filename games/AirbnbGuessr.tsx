'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Euro, TrendingUp, TrendingDown, Clock, MapPin, Home, Bed, Layout, Building2, Trophy, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AirbnbGuessrProps {
  roomCode: string;
}

export default function AirbnbGuessr({ roomCode }: AirbnbGuessrProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    airbnb,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'airbnb');

  // --- DERIVED STATE ---
  const game = airbnb?.game || {};
  const gamePlayers = airbnb?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentListing = game.current_listing;
  const currentRound = game.current_round || 1;
  const timerStartAt = game.timer_start_at;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  const timerSeconds = Number(settings.time || 30);
  
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
                  if (userGuess !== '') setUserGuess('');
                  setGuessTime(0);
              }
          }
      }
  }, [gamePlayers, playerId, currentPhase]);

  // --- HOST LOGIC ---

  // Start/Next Round
  const startRound = async () => {
      if (!isHost || !roomId) return;
      
      try {
          const data = await fetch(`/api/games/airbnb?count=1`);
          const listings = await data.json();
          
          if (!listings || listings.length === 0) {
              toast.error("Erreur lors du chargement du logement");
              return;
          }
          
          const nextListing = listings[0];
          
          // 1. Initial Setup if needed (First Round)
          if (currentPhase === 'setup') {
              // Initialize players
              const playerInserts = players.map(p => ({
                  room_id: roomId,
                  player_id: p.id,
                  score: 0,
                  has_guessed: false,
                  guess_time_ms: 0
              }));
              
              await supabase.from('airbnb_players').delete().eq('room_id', roomId);
              await supabase.from('airbnb_players').insert(playerInserts);

              // Create Game Entry
              await supabase.from('airbnb_games').upsert({
                  room_id: roomId,
                  phase: 'playing',
                  current_round: 1,
                  total_rounds: totalRounds,
                  timer_seconds: timerSeconds,
                  current_listing: nextListing,
                  timer_start_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
              }, { onConflict: 'room_id' });
              
              await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          } else {
              // Next Round
              await supabase.from('airbnb_players').update({
                  has_guessed: false,
                  last_guess: null,
                  guess_diff_percent: null,
                  guess_time_ms: 0
              }).eq('room_id', roomId);
              
              await supabase.from('airbnb_games').update({
                  phase: 'playing',
                  current_listing: nextListing,
                  timer_start_at: new Date().toISOString(),
                  current_round: currentRound + 1
              }).eq('room_id', roomId);
          }

      } catch (error) {
          console.error("Start Round Error:", error);
          toast.error("Erreur lors du lancement de la manche");
      }
  };

  // End Round / Calculate Scores
  const endRound = async () => {
      if (!isHost || !roomId || !currentListing) return;
      
      const realPrice = currentListing.price_per_night;
      
      const { data: latestPlayers } = await supabase.from('airbnb_players').select('*').eq('room_id', roomId);
      
      if (!latestPlayers) return;
      
      const updates = latestPlayers.map(p => {
          if (!p.has_guessed || p.last_guess === null) {
              return { 
                  player_id: p.player_id, 
                  score: p.score, 
                  guess_diff_percent: 100 
              }; 
          }
          
          const guess = p.last_guess;
          const diff = Math.abs(guess - realPrice);
          const diffPercent = (diff / realPrice) * 100;
          
          let points = 0;
          if (diffPercent < 5) points = 1000;
          else if (diffPercent < 15) points = 700;
          else if (diffPercent < 30) points = 400;
          else if (diffPercent < 50) points = 200;
          
          if (points > 0 && p.guess_time_ms < 10000) {
              points += 200;
          }
          
          return {
              player_id: p.player_id,
              score: p.score + points,
              guess_diff_percent: diffPercent
          };
      });
      
      for (const update of updates) {
          await supabase.from('airbnb_players').update({
              score: update.score,
              guess_diff_percent: update.guess_diff_percent
          }).match({ room_id: roomId, player_id: update.player_id });
          
          await supabase.from('players').update({ score: update.score }).eq('id', update.player_id);
      }
      
      await supabase.from('airbnb_games').update({
          phase: 'round_results'
      }).eq('room_id', roomId);
      
      if (currentRound < totalRounds) {
          setTimeout(() => startRound(), 4000);
      } else {
          setTimeout(() => {
              supabase.from('airbnb_games').update({ phase: 'podium' }).eq('room_id', roomId);
          }, 4000);
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
          const allAnswered = gamePlayers.length > 0 && gamePlayers.every((p: any) => p.has_guessed);
          
          if (timeIsUp || allAnswered) {
              endRound();
          }
      };
      
      const interval = setInterval(checkEnd, 1000);
      return () => clearInterval(interval);
  }, [isHost, currentPhase, timerStartAt, timerSeconds, gamePlayers]);

  // --- PLAYER ACTIONS ---

  const handleGuess = async () => {
      if (!roomId || !playerId || !userGuess || hasGuessed) return;
      
      const guess = parseInt(userGuess);
      if (isNaN(guess)) return;
      
      const now = Date.now();
      const start = timerStartAt ? new Date(timerStartAt).getTime() : now;
      const timeTaken = now - start;
      
      await supabase.from('airbnb_players').update({
          has_guessed: true,
          last_guess: guess,
          guess_time_ms: timeTaken
      }).match({ room_id: roomId, player_id: playerId });
      
      setHasGuessed(true);
      toast.success("Estimation envoyée !");
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('airbnb_games').delete().eq('room_id', roomId);
      await supabase.from('airbnb_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}`);
  };

  // --- RENDER ---
  
  return (
      <GameLayout
          gameTitle="AirbnbGuessr"
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
                      <Home className="w-24 h-24 text-rose-400" />
                  </div>
                  
                  <div className="text-center space-y-4 max-w-lg">
                      <h2 className="text-4xl font-black text-[#F8FAFC] uppercase tracking-wider drop-shadow-lg">
                          Airbnb <span className="text-rose-400">Guessr</span>
                      </h2>
                      <p className="text-[#94A3B8] text-lg">
                          Devinez le prix par nuit de logements Airbnb incroyables. Plus vous êtes proche, plus vous gagnez de points !
                      </p>
                  </div>
                  
                  {isHost ? (
                      <Button 
                          onClick={startRound} 
                          size="lg" 
                          className="w-full max-w-xs h-16 text-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider rounded-xl shadow-[0_4px_0_0px_#020617] transition-all hover:scale-105"
                      >
                          Commencer la partie
                      </Button>
                  ) : (
                      <div className="flex items-center gap-3 bg-[#334155] px-6 py-3 rounded-full border border-[#475569]">
                          <Clock className="w-5 h-5 animate-spin text-rose-400" />
                          <span className="text-[#F8FAFC] font-medium">En attente de l'hôte...</span>
                      </div>
                  )}
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full w-full">
                  {/* Left: Property Details */}
                  <div className="space-y-4">
                      {/* Photo */}
                      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 group">
                          {currentListing?.photo_url ? (
                              <img 
                                  src={currentListing.photo_url} 
                                  alt="Logement Airbnb" 
                                  className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                              />
                          ) : (
                              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                                  <Home className="w-12 h-12 text-slate-400" />
                              </div>
                          )}
                          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-rose-400" />
                              {currentListing?.neighbourhood}, {currentListing?.city}
                          </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Users className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Voyageurs</span>
                              <span className="font-bold text-slate-100">{currentListing?.accommodates}</span>
                          </div>
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Bed className="w-5 h-5 text-pink-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Chambres</span>
                              <span className="font-bold text-slate-100">{currentListing?.bedrooms}</span>
                          </div>
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Home className="w-5 h-5 text-green-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Type</span>
                              <span className="font-bold text-slate-100 truncate w-full">{currentListing?.room_type}</span>
                          </div>
                      </div>
                  </div>

                  {/* Right: Input */}
                  <div className="flex flex-col gap-4 h-full justify-center">
                      <Card className="p-8 bg-slate-900 text-white border-slate-800 shadow-2xl">
                          <label className="block text-center text-lg font-medium text-slate-400 mb-4 uppercase tracking-wider">
                              Votre estimation (Prix par nuit)
                          </label>
                          <div className="flex gap-3 mb-4">
                              <div className="relative flex-1">
                                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
                                  <Input
                                      type="number"
                                      value={userGuess}
                                      onChange={(e) => setUserGuess(e.target.value)}
                                      disabled={hasGuessed}
                                      placeholder="Ex: 150"
                                      className="pl-12 h-16 text-2xl font-bold bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:ring-rose-500 text-center"
                                      onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                                  />
                              </div>
                          </div>
                          <Button 
                                  onClick={handleGuess} 
                                  disabled={hasGuessed || !userGuess}
                                  className={`w-full h-16 text-xl font-bold transition-all rounded-xl ${
                                      hasGuessed 
                                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20'
                                  }`}
                              >
                                  {hasGuessed ? 'Envoyé' : 'Valider'}
                              </Button>
                          {hasGuessed && (
                              <p className="mt-4 text-center text-green-400 font-medium animate-pulse flex items-center justify-center gap-2">
                                  <CheckCircle className="w-5 h-5" /> Estimation enregistrée !
                              </p>
                          )}
                      </Card>
                  </div>
              </div>
          )}

          {/* Round Results Phase */}
          {currentPhase === 'round_results' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full w-full">
                  {/* Result Card */}
                  <div className="flex flex-col items-center justify-center space-y-6 bg-slate-900 text-white p-8 rounded-3xl shadow-2xl border border-slate-800">
                      <div className="text-center space-y-2">
                          <h3 className="text-xl text-slate-400 font-medium">Le prix par nuit était de</h3>
                          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-600 animate-in zoom-in duration-500">
                              {currentListing?.price_per_night} €
                          </div>
                      </div>

                      {/* Winner of the round */}
                      {(() => {
                          const roundWinner = gamePlayers
                              .filter((p: any) => p.has_guessed && p.guess_diff_percent !== null)
                              .sort((a: any, b: any) => a.guess_diff_percent - b.guess_diff_percent)[0];
                              
                          if (!roundWinner) return null;
                          
                          const playerInfo = players.find(p => p.id === roundWinner.player_id);
                          const diff = Math.abs(roundWinner.last_guess - (currentListing?.price_per_night || 0));
                          
                          return (
                              <div className="bg-white/10 p-4 rounded-xl w-full text-center border border-white/10">
                                  <div className="flex items-center justify-center gap-2 mb-1">
                                      <Trophy className="w-5 h-5 text-yellow-400" />
                                      <span className="font-bold text-yellow-400">Meilleure estimation</span>
                                  </div>
                                  <div className="text-2xl font-bold">{playerInfo?.name || 'Inconnu'}</div>
                                  <div className="text-slate-300">
                                      {roundWinner.last_guess} € (écart de {diff} €)
                                  </div>
                              </div>
                          );
                      })()}
                  </div>

                  {/* Player Guesses List */}
                  <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-rose-500" />
                          Estimations des joueurs
                      </h3>
                      
                      {gamePlayers
                          .filter((p: any) => p.has_guessed)
                          .sort((a: any, b: any) => (a.guess_diff_percent || 100) - (b.guess_diff_percent || 100))
                          .map((p: any) => {
                              const playerInfo = players.find(pl => pl.id === p.player_id);
                              const guess = p.last_guess;
                              const realPrice = currentListing?.price_per_night || 0;
                              const diff = guess - realPrice;
                              const isPositive = diff > 0;
                              
                              return (
                                  <div key={p.player_id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm backdrop-blur-sm">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center font-bold text-rose-400">
                                              {playerInfo?.name.charAt(0)}
                                          </div>
                                          <div>
                                              <div className="font-bold text-slate-100">{playerInfo?.name}</div>
                                              <div className="text-xs text-slate-400 flex items-center gap-1">
                                                  {guess} €
                                                  <span className={isPositive ? 'text-red-400' : 'text-blue-400'}>
                                                      ({isPositive ? '+' : ''}{diff} €)
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <div className="font-black text-xl text-rose-400">
                                              {p.score} pts
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                  </div>
              </div>
          )}

          {/* Podium Phase */}
          {currentPhase === 'podium' && (
              <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                  <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                  <h2 className="text-4xl font-black text-[#F8FAFC] mb-8">Classement Final</h2>
                  
                  <div className="w-full space-y-2 mb-8">
                      {players.sort((a, b) => b.score - a.score).map((p, i) => (
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
                              <span className="text-2xl font-mono font-black text-rose-400">{p.score} pts</span>
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

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
    );
}