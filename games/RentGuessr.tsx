'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';



import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Euro, TrendingUp, TrendingDown, Clock, MapPin, Home, Bed, Layout, Building2, Trophy, ArrowLeft, ArrowRight, Layers, Loader2 } from 'lucide-react';
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
    broadcast,
    isConnected
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

  // Force transition to podium after round_results (fallback)
  useEffect(() => {
    if (!isHost || currentPhase !== 'round_results') return;
    
    const timeout = setTimeout(async () => {
      if (currentRound >= totalRounds) {
        await supabase.from('rent_games').update({ phase: 'podium' }).eq('room_id', roomId);
      }
    }, 8000);
    
    return () => clearTimeout(timeout);
  }, [isHost, currentPhase, currentRound, totalRounds, roomId]);

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
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('rent_games').delete().eq('room_id', roomId);
      await supabase.from('rent_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- RENDER ---
  
  return (
      <GameLayout
          isConnected={isConnected}
          gameTitle="RentGuessr"
          roundCount={currentRound}
          maxRounds={totalRounds}
          timer={timeLeft.toString()}
          timeLeft={timeLeft}
          voteToLobby={<VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} />}
      >
          {currentPhase === 'setup' && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
                  <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                      <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform -rotate-3">
                          <Home className="w-16 h-16 text-accent-primary" />
                      </div>
                      
                      <div className="text-center space-y-2 mb-8">
                          <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">
                              Rent <span className="text-accent-primary">Guessr</span>
                          </h2>
                          <p className="text-tx-secondary font-bold">
                              Devinez le loyer mensuel de biens immobiliers.
                          </p>
                      </div>
                      
                      {isHost ? (
                          <button 
                              onClick={startRound} 
                              className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary shadow-brutal"
                          >
                              COMMENCER LA PARTIE
                          </button>
                      ) : (
                           <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                              <Clock className="w-6 h-6 animate-spin text-accent-primary" />
                              <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div key={game.current_round} className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full w-full p-4 animate-in fade-in duration-300">
                  {/* Left: Property Details & Map */}
                  <div className="space-y-4">
                      {/* Photo */}
                      <div className="relative aspect-video rounded-[32px] overflow-hidden shadow-brutal border-4 border-brand-border group bg-brand-inner">
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
                                              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-brand-bg/80 text-tx-base border-2 border-brand-border rounded-xl hover:bg-brand-inner transition-colors z-10 shadow-brutal active:translate-y-1 active:shadow-none"
                                          >
                                              <ArrowLeft className="w-6 h-6" />
                                          </button>
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setCurrentPhotoIndex(prev => prev === currentProperty.photos_url.length - 1 ? 0 : prev + 1);
                                              }}
                                              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-brand-bg/80 text-tx-base border-2 border-brand-border rounded-xl hover:bg-brand-inner transition-colors z-10 shadow-brutal active:translate-y-1 active:shadow-none"
                                          >
                                              <ArrowRight className="w-6 h-6" />
                                          </button>
                                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-bg/80 text-tx-base border-2 border-brand-border px-4 py-1.5 rounded-xl font-bold font-mono shadow-brutal">
                                              {currentPhotoIndex + 1} / {currentProperty.photos_url.length}
                                          </div>
                                      </>
                                  )}
                              </>
                          ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                  <Home className="w-16 h-16 text-tx-muted" />
                              </div>
                          )}
                          <div className="absolute top-4 left-4 bg-brand-bg/90 border-2 border-brand-border text-tx-base px-4 py-2 rounded-xl font-black uppercase tracking-widest flex items-center gap-2 z-10 shadow-brutal">
                              <MapPin className="w-5 h-5 text-accent-secondary" />
                              {currentProperty?.district ? `${currentProperty.district}, ` : ''}{currentProperty?.city} ({currentProperty?.postal_code})
                          </div>
                      </div>

                      {/* Description (if available) */}
                      {currentProperty?.description && (
                        <div className="text-sm text-tx-secondary italic line-clamp-2 px-2 font-bold">
                          "{currentProperty.description.replace(/<[^>]*>?/gm, '')}"
                        </div>
                      )}

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-brand-card p-4 rounded-2xl border-4 border-brand-border shadow-brutal flex flex-col items-center justify-center text-center">
                              <Layout className="w-6 h-6 text-[#06B6D4] mb-2" />
                              <span className="text-xs text-tx-secondary uppercase font-bold tracking-widest">Surface</span>
                              <span className="font-display font-black text-tx-base text-lg">{currentProperty?.surface_m2} m²</span>
                          </div>
                          <div className="bg-brand-card p-4 rounded-2xl border-4 border-brand-border shadow-brutal flex flex-col items-center justify-center text-center">
                              <Building2 className="w-6 h-6 text-accent-primary mb-2" />
                              <span className="text-xs text-tx-secondary uppercase font-bold tracking-widest">Pièces</span>
                              <span className="font-display font-black text-tx-base text-lg">{currentProperty?.nb_rooms}</span>
                          </div>
                          <div className="bg-brand-card p-4 rounded-2xl border-4 border-brand-border shadow-brutal flex flex-col items-center justify-center text-center">
                              <Bed className="w-6 h-6 text-accent-secondary mb-2" />
                              <span className="text-xs text-tx-secondary uppercase font-bold tracking-widest">Chambres</span>
                              <span className="font-display font-black text-tx-base text-lg">{currentProperty?.nb_bedrooms}</span>
                          </div>
                          <div className="bg-brand-card p-4 rounded-2xl border-4 border-brand-border shadow-brutal flex flex-col items-center justify-center text-center">
                              {currentProperty?.floor !== null && currentProperty?.floor !== undefined ? (
                                  <>
                                      <Layers className="w-6 h-6 text-[#FFD000] mb-2" />
                                      <span className="text-xs text-tx-secondary uppercase font-bold tracking-widest">Étage</span>
                                      <span className="font-display font-black text-tx-base text-lg">{currentProperty.floor === 0 ? 'RDC' : currentProperty.floor}</span>
                                  </>
                              ) : (
                                  <>
                                      <Home className="w-6 h-6 text-accent-success mb-2" />
                                      <span className="text-xs text-tx-secondary uppercase font-bold tracking-widest">Type</span>
                                      <span className="font-display font-black text-tx-base text-lg truncate w-full">{currentProperty?.property_type}</span>
                                  </>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Right: Map & Input */}
                  <div className="flex flex-col gap-6 h-full">
                      {/* Map */}
                      <div className="flex-1 min-h-[250px] relative rounded-[32px] overflow-hidden shadow-brutal border-4 border-brand-border bg-brand-inner">
                          {currentProperty && (
                              <LeafletMap 
                                  latitude={currentProperty.latitude} 
                                  longitude={currentProperty.longitude} 
                                  zoom={13}
                              />
                          )}
                      </div>

                      {/* Input Area */}
                      <div className="p-6 bg-brand-card border-4 border-brand-border rounded-[32px] shadow-brutal">
                          <label className="block text-sm font-black text-tx-secondary mb-4 uppercase tracking-widest">
                              Votre estimation (Loyer Mensuel)
                          </label>
                          <div className="flex gap-3">
                              <div className="relative flex-1">
                                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-tx-secondary pointer-events-none">
                                      <Euro className="w-6 h-6" />
                                  </div>
                                  <input
                                      type="number"
                                      value={userGuess}
                                      onChange={(e) => setUserGuess(e.target.value)}
                                      disabled={hasGuessed}
                                      placeholder="Ex: 1200"
                                      className="w-full pl-12 h-16 text-2xl font-bold bg-brand-inner border-4 border-brand-border rounded-2xl text-tx-base placeholder:text-tx-muted focus:outline-none focus:border-tx-base transition-colors shadow-brutal disabled:opacity-50"
                                      onKeyDown={(e) => e.key === 'Enter' && handleGuess()}
                                  />
                              </div>
                              <button 
                                  onClick={handleGuess} 
                                  disabled={hasGuessed || !userGuess}
                                  className={cn(
                                      "h-16 px-8 text-xl font-display font-black tracking-wider rounded-2xl transition-all flex items-center justify-center border-4 border-brand-border shadow-brutal disabled:opacity-50 disabled:cursor-not-allowed",
                                      hasGuessed 
                                      ? "bg-brand-inner text-tx-muted" 
                                      : "bg-accent-success text-brand-bg hover:bg-tx-base"
                                  )}
                              >
                                  {hasGuessed ? 'ENVOYÉ' : 'VALIDER'}
                              </button>
                          </div>
                          {hasGuessed && (
                              <p className="mt-4 text-center text-sm text-tx-secondary font-bold uppercase tracking-widest animate-pulse">
                                  Estimation enregistrée ! En attente des autres...
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* Round Results Phase */}
          {currentPhase === 'round_results' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full w-full p-4">
                  {/* Result Card */}
                  <div className="flex flex-col items-center justify-center space-y-8 bg-brand-card text-tx-base p-10 rounded-[32px] shadow-brutal border-4 border-brand-border">
                      <div className="text-center space-y-4">
                          <h3 className="text-xl text-tx-secondary font-black uppercase tracking-widest">Le loyer réel était de</h3>
                          <div className="font-display text-6xl font-black text-accent-success animate-in zoom-in duration-500 bg-brand-inner px-8 py-4 rounded-3xl border-4 border-brand-border shadow-brutal">
                              {currentProperty?.price_per_month} €
                          </div>
                          <div className="text-sm text-tx-muted font-bold uppercase tracking-widest">par mois</div>
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
                              <div className="bg-brand-inner p-6 rounded-2xl w-full text-center border-4 border-brand-border shadow-brutal transform rotate-1">
                                  <div className="flex items-center justify-center gap-3 mb-2">
                                      <Trophy className="w-6 h-6 text-[#FFD000]" />
                                      <span className="font-black text-[#FFD000] uppercase tracking-widest">Meilleure estimation</span>
                                  </div>
                                  <div className="font-display text-3xl font-black text-tx-base mb-1">{playerInfo?.name || 'Inconnu'}</div>
                                  <div className="text-tx-secondary font-bold">
                                      {roundWinner.last_guess} € (écart de {diff} €)
                                  </div>
                              </div>
                          );
                      })()}
                  </div>

                  {/* Player Guesses List */}
                  <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
                      <h3 className="font-display font-black text-2xl text-tx-base flex items-center gap-3 mb-6 uppercase tracking-wider">
                          <TrendingUp className="w-8 h-8 text-accent-primary" />
                          Estimations
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
                                  <div key={p.player_id} className="bg-brand-card p-4 rounded-2xl border-4 border-brand-border flex items-center justify-between shadow-brutal mb-4">
                                      <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 rounded-xl bg-brand-inner border-2 border-brand-border flex items-center justify-center font-display font-black text-xl text-tx-base">
                                              {playerInfo?.name.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                              <div className="font-display font-black text-lg text-tx-base">{playerInfo?.name}</div>
                                              <div className="text-sm font-bold text-tx-secondary flex items-center gap-2">
                                                  {guess} €
                                                  <span className={cn(
                                                      "px-2 py-0.5 rounded-md text-xs border-2",
                                                      isPositive ? 'bg-accent-secondary/20 text-accent-secondary border-accent-secondary' : 'bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]'
                                                  )}>
                                                      {isPositive ? '+' : ''}{diff} €
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <div className="font-display font-black text-2xl text-accent-primary bg-brand-inner px-3 py-1 rounded-xl border-2 border-brand-border">
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
                  <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                      <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                          <Trophy className="w-16 h-16 text-accent-primary" />
                      </div>
                      <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                      
                      <div className="w-full space-y-4 mb-8">
                          {gamePlayers
                              .map((gp: any) => ({
                                  ...gp,
                                  name: players.find((p: any) => p.id === gp.player_id)?.name || 'Inconnu'
                              }))
                              .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                              .map((p: any, i: number) => (
                              <div key={p.id} className={cn(
                                  "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                  i === 0 ? "bg-accent-primary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                              )}>
                                  {/* Badges */}
                                  {i === 0 && (
                                      <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                          Expert Immobilier
                                      </div>
                                  )}
                                  
                                  <div className="flex items-center gap-4">
                                      <span className={cn(
                                          "w-12 h-12 flex items-center justify-center rounded-xl font-display font-black text-2xl border-2 border-brand-border",
                                          i === 0 ? "bg-[#FFD000] text-brand-bg" : "bg-brand-bg text-tx-base"
                                      )}>
                                          {i + 1}
                                      </span>
                                      
                                      <div className="flex flex-col text-left">
                                          <span className="text-xl font-display font-black">{p.name}</span>
                                          <span className={cn(
                                              "text-xs font-bold uppercase tracking-widest",
                                              i === 0 ? "text-brand-bg/80" : "text-tx-secondary"
                                          )}>
                                              {i === 0 ? '🤑 Le Juste Prix' : '📉 Négociateur'}
                                          </span>
                                      </div>
                                  </div>
                               <span className={cn(
                                   "text-3xl font-display font-black",
                                   i === 0 ? "text-brand-bg" : "text-accent-primary"
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
       </GameLayout>
   );
 }
