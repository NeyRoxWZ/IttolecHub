'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Euro, TrendingUp, TrendingDown, Clock, MapPin, Home, Bed, Layout, Building2, Trophy, ArrowLeft, ArrowRight, Layers } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { vibrate, HAPTIC } from '@/lib/haptic';

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
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // --- EFFECTS ---

  // Reset photo index on new round
  useEffect(() => {
      setCurrentPhotoIndex(0);
  }, [currentProperty]);

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
  }, [currentProperty?.id, currentPhase]);

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
          
          // Use photos_url array if available, otherwise fallback to photo_url (single) or placeholder
          // The new JSON has photos_url array
          if (nextProperty.photos_url && Array.isArray(nextProperty.photos_url) && nextProperty.photos_url.length > 0) {
             nextProperty.photo_url = nextProperty.photos_url[0]; // For backward compatibility in view
          }
          
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
      
      setHasGuessed(true); // Optimistic Update
      vibrate(HAPTIC.MEDIUM);
      toast.success("Estimation envoyée !");

      const now = Date.now();
      const start = timerStartAt ? new Date(timerStartAt).getTime() : now;
      const timeTaken = now - start;
      
      await supabase.from('rent_players').update({
          has_guessed: true,
          last_guess: guess,
          guess_time_ms: timeTaken
      }).match({ room_id: roomId, player_id: playerId });
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      
      // Cleanup
      await supabase.from('rent_games').delete().eq('room_id', roomId);
      await supabase.from('rent_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}`);
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
                      <Home className="w-24 h-24 text-indigo-400" />
                  </div>
                  
                  <div className="text-center space-y-4 max-w-lg">
                      <h2 className="text-4xl font-black text-[#F8FAFC] uppercase tracking-wider drop-shadow-lg">
                          Rent <span className="text-indigo-400">Guessr</span>
                      </h2>
                      <p className="text-[#94A3B8] text-lg">
                          Devinez le loyer mensuel de biens immobiliers à travers la France. Plus vous êtes proche, plus vous gagnez de points !
                      </p>
                  </div>
                  
                  {isHost ? (
                      <Button 
                          onClick={startRound} 
                          size="lg" 
                          className="w-full max-w-xs h-16 text-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-black uppercase tracking-wider rounded-xl shadow-[0_4px_0_0px_#020617] transition-all hover:scale-105"
                      >
                          Commencer la partie
                      </Button>
                  ) : (
                       <div className="flex items-center gap-3 bg-[#334155] px-6 py-3 rounded-full border border-[#475569]">
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
                      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200 dark:border-slate-700 group bg-slate-900">
                          {currentProperty ? (
                              <>
                                  <img 
                                      src={currentProperty.photos_url ? currentProperty.photos_url[currentPhotoIndex] : currentProperty.photo_url} 
                                      alt={`Bien immobilier - Photo ${currentPhotoIndex + 1}`}
                                      className="object-contain w-full h-full transition-transform duration-700 hover:scale-105"
                                  />
                                  
                                  {/* Photo Navigation */}
                                  {currentProperty.photos_url && currentProperty.photos_url.length > 1 && (
                                      <>
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCurrentPhotoIndex(prev => prev === 0 ? currentProperty.photos_url.length - 1 : prev - 1);
                                              }}
                                              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
                                          >
                                              <ArrowLeft className="w-5 h-5" />
                                          </button>
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCurrentPhotoIndex(prev => prev === currentProperty.photos_url.length - 1 ? 0 : prev + 1);
                                              }}
                                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
                                          >
                                              <ArrowRight className="w-5 h-5" />
                                          </button>
                                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-2 py-1 rounded-full text-xs font-mono">
                                              {currentPhotoIndex + 1} / {currentProperty.photos_url.length}
                                          </div>
                                      </>
                                  )}
                              </>
                          ) : (
                              <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                                  <Home className="w-12 h-12 text-slate-400" />
                              </div>
                          )}
                          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 z-10">
                              <MapPin className="w-4 h-4 text-red-400" />
                              {currentProperty?.district ? `${currentProperty.district}, ` : ''}{currentProperty?.city} ({currentProperty?.postal_code})
                          </div>
                      </div>

                      {/* Description (if available) */}
                      {currentProperty?.description && (
                        <div className="text-xs text-slate-400 italic line-clamp-2 px-1">
                          "{currentProperty.description.replace(/<[^>]*>?/gm, '')}"
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-[#1E293B] p-3 rounded-xl border border-[#334155] flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Layout className="w-5 h-5 text-indigo-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Surface</span>
                              <span className="font-bold text-slate-100">{currentProperty?.surface_m2} m²</span>
                          </div>
                          <div className="bg-[#1E293B] p-3 rounded-xl border border-[#334155] flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Building2 className="w-5 h-5 text-purple-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Pièces</span>
                              <span className="font-bold text-slate-100">{currentProperty?.nb_rooms}</span>
                          </div>
                          <div className="bg-[#1E293B] p-3 rounded-xl border border-[#334155] flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              <Bed className="w-5 h-5 text-pink-500 mb-1" />
                              <span className="text-xs text-slate-400 uppercase font-bold">Chambres</span>
                              <span className="font-bold text-slate-100">{currentProperty?.nb_bedrooms}</span>
                          </div>
                          <div className="bg-[#1E293B] p-3 rounded-xl border border-[#334155] flex flex-col items-center justify-center text-center backdrop-blur-sm">
                              {currentProperty?.floor !== null && currentProperty?.floor !== undefined ? (
                                  <>
                                      <Layers className="w-5 h-5 text-yellow-500 mb-1" />
                                      <span className="text-xs text-slate-400 uppercase font-bold">Étage</span>
                                      <span className="font-bold text-slate-100">{currentProperty.floor === 0 ? 'RDC' : currentProperty.floor}</span>
                                  </>
                              ) : (
                                  <>
                                      <Home className="w-5 h-5 text-green-500 mb-1" />
                                      <span className="text-xs text-slate-400 uppercase font-bold">Type</span>
                                      <span className="font-bold text-slate-100 truncate w-full">{currentProperty?.property_type}</span>
                                  </>
                              )}
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
                      <Card className="p-6 bg-[#0F172A] text-[#F8FAFC] border-[#334155]">
                          <label className="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">
                              Votre estimation (Loyer Mensuel)
                          </label>
                          <div className="flex gap-3 items-stretch">
                              <div className="relative flex-1">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                      <Euro className="w-5 h-5" />
                                  </div>
                                  <input
                                      type="number"
                                      value={userGuess}
                                      onChange={(e) => setUserGuess(e.target.value)}
                                      disabled={hasGuessed}
                                      placeholder="Ex: 1200"
                                      className="w-full pl-10 h-14 text-xl font-bold bg-[#334155] border border-[#475569] rounded-xl text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all appearance-none"
                                      onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                                  />
                              </div>
                              <button 
                                  onClick={handleGuess} 
                                  disabled={hasGuessed || !userGuess}
                                  className={`h-14 px-6 text-lg font-bold rounded-xl transition-all flex items-center justify-center min-w-[100px] active:scale-95 ${
                                      hasGuessed 
                                      ? 'bg-green-600 cursor-default opacity-100' 
                                      : 'bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-[0_4px_0_0px_#020617]'
                                  }`}
                              >
                                  {hasGuessed ? 'Envoyé' : 'Valider'}
                              </button>
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
                  <div className="flex flex-col items-center justify-center space-y-6 bg-[#0F172A] text-[#F8FAFC] p-8 rounded-3xl shadow-2xl border border-[#334155]">
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
                                  <div key={p.player_id} className="bg-[#1E293B] p-4 rounded-xl border border-[#334155] flex items-center justify-between shadow-sm backdrop-blur-sm">
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
                                      Expert Immobilier
                                  </div>
                              )}
                              
                              <div className="flex items-center gap-4">
                                  <span className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-xl ${
                                      i === 0 ? 'bg-yellow-500 text-black' : 
                                      i === 1 ? 'bg-slate-400 text-slate-900' :
                                      i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-[#334155] text-[#94A3B8]'
                                  }`}>{i + 1}</span>
                                  
                                  <div className="flex flex-col">
                                      <span className="text-xl font-bold text-[#F8FAFC]">{p.name}</span>
                                      {/* Fake Stat for Demo */}
                                      <span className="text-xs text-slate-400 font-medium">
                                          {i === 0 ? '🤑 Le Juste Prix' : '📉 Négociateur'}
                                      </span>
                                  </div>
                              </div>
                              <span className="text-3xl font-mono font-black text-indigo-400">{p.score}</span>
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
      </GameLayout>
  );
}