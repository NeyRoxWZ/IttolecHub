'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Euro, TrendingUp, TrendingDown, Clock, MapPin, Home, Bed, Layout, Building2, Trophy } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl" /> 
});

interface RentGuessrProps {
  roomCode: string;
}

export default function RentGuessr({ roomCode }: RentGuessrProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    rent,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'rent');

  // --- DERIVED STATE ---
  const game = rent?.game || {};
  const gamePlayers = rent?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentProperty = game.current_property;
  const currentRound = game.current_round || 1;
  const timerStartAt = game.timer_start_at;
  
  // Settings from Room
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
          const data = await fetch(`/api/games/rent?count=1`);
          const properties = await data.json();
          
          if (!properties || properties.length === 0) {
              toast.error("Erreur lors du chargement du bien immobilier");
              return;
          }
          
          const nextProperty = properties[0];
          
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
              
              await supabase.from('rent_players').delete().eq('room_id', roomId);
              await supabase.from('rent_players').insert(playerInserts);

              // Create Game Entry
              await supabase.from('rent_games').upsert({
                  room_id: roomId,
                  phase: 'playing',
                  current_round: 1,
                  total_rounds: totalRounds,
                  timer_seconds: timerSeconds,
                  current_property: nextProperty,
                  timer_start_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
              }, { onConflict: 'room_id' });
              
              await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          } else {
              // Next Round
              await supabase.from('rent_players').update({
                  has_guessed: false,
                  last_guess: null,
                  guess_diff_percent: null,
                  guess_time_ms: 0
              }).eq('room_id', roomId);
              
              await supabase.from('rent_games').update({
                  phase: 'playing',
                  current_property: nextProperty,
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
      if (!isHost || !roomId || !currentProperty) return;
      
      const realPrice = currentProperty.price_per_month;
      
      const { data: latestPlayers } = await supabase.from('rent_players').select('*').eq('room_id', roomId);
      
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
          await supabase.from('rent_players').update({
              score: update.score,
              guess_diff_percent: update.guess_diff_percent
          }).match({ room_id: roomId, player_id: update.player_id });
          
          await supabase.from('players').update({ score: update.score }).eq('id', update.player_id);
      }
      
      await supabase.from('rent_games').update({
          phase: 'round_results'
      }).eq('room_id', roomId);
      
      if (currentRound < totalRounds) {
          setTimeout(() => startRound(), 4000);
      } else {
          setTimeout(() => {
              supabase.from('rent_games').update({ phase: 'podium' }).eq('room_id', roomId);
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
      
      await supabase.from('rent_players').update({
          has_guessed: true,
          last_guess: guess,
          guess_time_ms: timeTaken
      }).match({ room_id: roomId, player_id: playerId });
      
      setHasGuessed(true);
      toast.success("Estimation envoyée !");
  };

  // --- RENDER ---
  
  return (
      <GameLayout
          gameTitle="RentGuessr"
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
                      <div className="absolute -inset-1 bg-indigo-500 rounded-full blur opacity-25 animate-pulse"></div>
                      <div className="relative p-8 bg-slate-900 rounded-full border-4 border-indigo-500 shadow-2xl">
                          <Home className="w-16 h-16 text-indigo-400" />
                      </div>
                  </div>
                  
                  <div className="text-center space-y-4 max-w-lg">
                      <h2 className="text-4xl font-black text-white uppercase tracking-wider drop-shadow-lg">
                          Rent <span className="text-indigo-400">Guessr</span>
                      </h2>
                      <p className="text-slate-400 text-lg">
                          Devinez le loyer mensuel de biens immobiliers à travers la France. Plus vous êtes proche, plus vous gagnez de points !
                      </p>
                  </div>
                  
                  {isHost ? (
                      <Button 
                          onClick={startRound} 
                          size="lg" 
                          className="w-full max-w-xs h-16 text-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all hover:scale-105"
                      >
                          Commencer la partie
                      </Button>
                  ) : (
                      <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-full border border-white/10">
                          <Clock className="w-5 h-5 animate-spin text-indigo-400" />
                          <span className="text-slate-300 font-medium">En attente de l'hôte...</span>
                      </div>
                  )}
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full w-full">
                  {/* Left: Property Details & Map */}
                  <div className="space-y-4">
                      {/* Photo */}
                      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 group">
                          {currentProperty?.photo_url ? (
                              <img 
                                  src={currentProperty.photo_url} 
                                  alt="Bien immobilier" 
                                  className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                              />
                          ) : (
                              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                                  <Home className="w-12 h-12 text-slate-400" />
                              </div>
                          )}
                          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-red-400" />
                              {currentProperty?.city} ({currentProperty?.postal_code})
                          </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Layout className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Surface</span>
                              <span className="font-bold text-slate-100">{currentProperty?.surface_m2} m²</span>
                          </div>
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Building2 className="w-5 h-5 text-purple-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Pièces</span>
                              <span className="font-bold text-slate-100">{currentProperty?.nb_rooms}</span>
                          </div>
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Bed className="w-5 h-5 text-pink-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Chambres</span>
                              <span className="font-bold text-slate-100">{currentProperty?.nb_bedrooms}</span>
                          </div>
                          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Home className="w-5 h-5 text-green-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Type</span>
                              <span className="font-bold text-slate-100 truncate w-full">{currentProperty?.property_type}</span>
                          </div>
                      </div>
                  </div>

                  {/* Right: Map & Input */}
                  <div className="flex flex-col gap-4 h-full">
                      {/* Map */}
                      <div className="flex-1 min-h-[250px] relative rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700">
                          {currentProperty && (
                              <LeafletMap 
                                  latitude={currentProperty.latitude} 
                                  longitude={currentProperty.longitude} 
                                  zoom={13}
                              />
                          )}
                      </div>

                      {/* Input Area */}
                      <Card className="p-6 bg-slate-900 text-white border-slate-800">
                          <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
                              Votre estimation (Loyer Mensuel)
                          </label>
                          <div className="flex gap-3">
                              <div className="relative flex-1">
                                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                  <Input
                                      type="number"
                                      value={userGuess}
                                      onChange={(e) => setUserGuess(e.target.value)}
                                      disabled={hasGuessed}
                                      placeholder="Ex: 1200"
                                      className="pl-10 h-14 text-xl font-bold bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:ring-indigo-500"
                                      onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                                  />
                              </div>
                              <Button 
                                  onClick={handleGuess} 
                                  disabled={hasGuessed || !userGuess}
                                  className={`h-14 px-8 text-lg font-bold transition-all ${
                                      hasGuessed 
                                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
                                  }`}
                              >
                                  {hasGuessed ? 'Envoyé' : 'Valider'}
                              </Button>
                          </div>
                          {hasGuessed && (
                              <p className="mt-3 text-center text-sm text-green-400 font-medium animate-pulse">
                                  Estimation enregistrée ! Attente des autres joueurs...
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
                          <h3 className="text-xl text-slate-400 font-medium">Le loyer réel était de</h3>
                          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 animate-in zoom-in duration-500">
                              {currentProperty?.price_per_month} €
                          </div>
                          <div className="text-sm text-slate-500">par mois</div>
                      </div>

                      {/* Winner of the round */}
                      {(() => {
                          const roundWinner = gamePlayers
                              .filter((p: any) => p.has_guessed && p.guess_diff_percent !== null)
                              .sort((a: any, b: any) => a.guess_diff_percent - b.guess_diff_percent)[0];
                              
                          if (!roundWinner) return null;
                          
                          const playerInfo = players.find(p => p.id === roundWinner.player_id);
                          const diff = Math.abs(roundWinner.last_guess - (currentProperty?.price_per_month || 0));
                          
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
                          <TrendingUp className="w-5 h-5 text-indigo-500" />
                          Estimations des joueurs
                      </h3>
                      
                      {gamePlayers
                          .filter((p: any) => p.has_guessed)
                          .sort((a: any, b: any) => (a.guess_diff_percent || 100) - (b.guess_diff_percent || 100))
                          .map((p: any) => {
                              const playerInfo = players.find(pl => pl.id === p.player_id);
                              const guess = p.last_guess;
                              const realPrice = currentProperty?.price_per_month || 0;
                              const diff = guess - realPrice;
                              const isPositive = diff > 0;
                              
                              return (
                                  <div key={p.player_id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm backdrop-blur-sm">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-indigo-400">
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
                                          <div className="font-black text-xl text-indigo-400">
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
                  <h2 className="text-4xl font-black text-white mb-8">Classement Final</h2>
                  
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
                              <span className="text-2xl font-mono font-black text-indigo-400">{p.score} pts</span>
                          </div>
                      ))}
                  </div>
                  
                  {isHost && (
                      <Button onClick={() => {
                          broadcast('return_to_lobby', {});
                          router.push(`/room/${roomCode}`);
                      }} size="lg" className="bg-slate-700 hover:bg-slate-600 font-bold">
                          Retour au salon
                      </Button>
                  )}
              </div>
          )}
      </GameLayout>
  );
}