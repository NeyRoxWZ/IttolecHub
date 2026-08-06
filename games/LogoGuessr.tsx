'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';


import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, Trophy, Send, Loader2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { vibrate, HAPTIC } from '@/lib/haptic';

const BRANDFETCH_CLIENT_ID = '1idE9skP3OyDrucd4OC';

const getLogoUrl = (domain: string): string => {
  return `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${BRANDFETCH_CLIENT_ID}`;
};

const getInitials = (name: string): string => {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
};

const getPlaceholderColor = (domain: string): string => {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1'];
  return colors[Math.abs(hash) % colors.length];
};

function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
  for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeString(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-'_\s]/g, '')
    .trim();
}

function getLevenshteinThreshold(nameLength: number): number {
  if (nameLength <= 3) return 0;
  if (nameLength <= 6) return 1;
  if (nameLength <= 10) return 2;
  return 3;
}

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
    broadcast,
    isConnected
  } = useGameSync(roomCode, 'logo');

  // --- DERIVED STATE ---
  const game = logo?.game || {};
  const gamePlayers = logo?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentLogo = game.current_logo;
  const currentRound = game.current_round || 1;
  const timerStartAt = game.timer_start_at;
  const logoQueue = game.queue || [];
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  const timerSeconds = Number(settings.time || 15);
  const difficulty = settings.difficulty || 'easy';

  // Players Map for GameLayout
  const playersMap = useMemo(() => {
    return players.reduce((acc, p) => {
        acc[p.name] = p.score;
        return acc;
    }, {} as Record<string, number>);
  }, [players]);

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [userGuess, setUserGuess] = useState('');
  const [hasFound, setHasFound] = useState(false);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const tileCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  
  // Difficulty effect state
  const [blurLevel, setBlurLevel] = useState(20); // For facile
  const [pixelSize, setPixelSize] = useState(320); // For difficile
  const [tilesRevealed, setTilesRevealed] = useState(0); // For moyen
  const shuffledTilesRef = useRef<{r: number, c: number}[]>([]); // For moyen

  // --- EFFECTS ---

  // Return to Lobby Broadcast
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'return_to_lobby') {
        router.push(`/room/${roomCode}?return=true`);
    }
  }, [lastEvent, roomCode, router]);

  // Timer & Difficulty Effects with smooth RAF
  useEffect(() => {
    if (currentPhase === 'setup') {
      setBlurLevel(0);
      setPixelSize(320); // canvas width
      setTimeLeft(0);
      return;
    }

    if (currentPhase !== 'playing') {
      setTimeLeft(0);
      setBlurLevel(0);
      setPixelSize(320);
      return;
    }

    if (!timerStartAt) return;

    const start = new Date(timerStartAt).getTime();
    const duration = timerSeconds * 1000;
    const canvasWidth = 320; // container size
    
    // Generate shuffled tiles for Moyen mode (once at start)
    const rows = 8;
    const cols = 8;
    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push({ r, c });
      }
    }
    // Fisher-Yates shuffle
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    shuffledTilesRef.current = tiles;

    let animationId: number;

    const update = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, start + duration - now);
      const remaining = Math.ceil(remainingMs / 1000);
      const timeLeft = remainingMs / 1000;
      
      setTimeLeft(remaining);
      
      // Use timeLeft directly for smooth calculation (same as easy mode)
      const timeRatio = timeLeft / (duration / 1000);
      
      if (difficulty === 'easy') {
        // Progressive deblur: 20px -> 0px
        const newBlur = 20 * timeRatio;
        setBlurLevel(newBlur);
        setPixelSize(canvasWidth);
        setTilesRevealed(0);
      } else if (difficulty === 'medium') {
        // Tile reveal: tiles disappear as time progresses (reveal logo)
        const totalTiles = rows * cols;
        const revealed = Math.floor((1 - timeRatio) * totalTiles);
        setTilesRevealed(revealed);
        setBlurLevel(0);
        setPixelSize(canvasWidth);
      } else if (difficulty === 'hard') {
        // Same linear formula as easy but with blockSize
        // blockSize = maxBlockSize * (timeLeft / totalTime)
        const maxBlockSize = 50;
        const blockSize = Math.max(1, Math.round(maxBlockSize * timeRatio));
        setPixelSize(blockSize);
        setBlurLevel(0);
        setTilesRevealed(0);
      }
      
      if (remaining > 0) {
        animationId = requestAnimationFrame(update);
      }
    };

    animationId = requestAnimationFrame(update);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [timerStartAt, timerSeconds, currentPhase, difficulty]);

  // Draw pixelated image on canvas - updated on every RAF frame
  useEffect(() => {
    if (difficulty !== 'hard' || !currentLogoUrl || !pixelCanvasRef.current || !imageLoaded) {
      return;
    }

    const canvas = pixelCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgRef.current) return;

    const img = imgRef.current;
    const containerSize = 320;
    
    const drawPixelated = () => {
      if (!ctx || !img || !img.width || !img.height) return;
      
      canvas.width = containerSize;
      canvas.height = containerSize;
      
      // blockSize: starts at containerSize (1 block = whole image), goes to 1 (full res)
      const blockSize = Math.max(1, pixelSize);
      
      if (blockSize <= 1) {
        // Full resolution
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, containerSize, containerSize);
        return;
      }
      
      // Create offscreen canvas for pixelation
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.max(1, Math.floor(containerSize / blockSize));
      offscreen.height = Math.max(1, Math.floor(containerSize / blockSize));
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;
      
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
      
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, containerSize, containerSize);
    };

    drawPixelated();
  }, [pixelSize, difficulty, imageLoaded]);

  // Draw tile reveal on canvas for Moyen mode
  useEffect(() => {
    if (difficulty !== 'medium' || !tileCanvasRef.current || !imageLoaded) {
      return;
    }

    const canvas = tileCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgRef.current) return;

    const img = imgRef.current;
    const containerSize = 320;
    const rows = 8;
    const cols = 8;
    const tileW = containerSize / cols;
    const tileH = containerSize / rows;

    canvas.width = containerSize;
    canvas.height = containerSize;

    // Draw the logo first (background)
    ctx.drawImage(img, 0, 0, containerSize, containerSize);

    // Draw black tiles over tiles that are NOT revealed yet
    // shuffledTiles.slice(tilesRevealed) = tiles from index tilesRevealed to end = NOT revealed
    const tilesToHide = shuffledTilesRef.current.slice(tilesRevealed);
    
    if (tilesToHide.length > 0) {
      ctx.fillStyle = '#000000';
      for (const tile of tilesToHide) {
        ctx.fillRect(tile.c * tileW, tile.r * tileH, tileW + 1, tileH + 1);
      }
    }
  }, [tilesRevealed, difficulty, imageLoaded]);

  // Load image for all modes
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  useEffect(() => {
    if (!currentLogoUrl) return;
    
    // Load image for all difficulties
    if ((difficulty === 'hard' || difficulty === 'medium') && !imageLoaded) {
      imgRef.current = null;
    }
    
    const img = new (window.Image || (globalThis as any).Image)();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    
    img.onerror = () => {
      setLogoError(true);
    };
    
    img.src = currentLogoUrl;
  }, [currentLogoUrl, difficulty]);

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
          setLogoError(false);
          setBlurLevel(difficulty === 'easy' ? 20 : 0);
          setPixelSize(difficulty === 'hard' ? 320 : 320);
          setTilesRevealed(0);
          setImageLoaded(false);
          if (currentLogo?.domain) {
              setCurrentLogoUrl(getLogoUrl(currentLogo.domain));
          }
      }
  }, [currentLogo?.id, currentPhase, currentLogo?.domain, difficulty]);

  // Submit guess on button click or Enter
  const handleSubmitGuess = async () => {
      if (!currentLogo || hasFound || !roomId || !playerId) return;
      if (!userGuess.trim()) return;
      
      const targetName = currentLogo.name;
      const guess = userGuess.trim();
      
      const targetNorm = normalizeString(targetName);
      const guessNorm = normalizeString(guess);
      
      // Exact match
      if (targetNorm === guessNorm) {
          await handleCorrectAnswer(guess);
          return;
      }
      
      // Levenshtein with threshold based on name length
      const threshold = getLevenshteinThreshold(targetName.length);
      const distance = levenshteinDistance(guessNorm, targetNorm);
      
      if (distance <= threshold) {
          await handleCorrectAnswer(guess);
      } else {
          vibrate(HAPTIC.ERROR);
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
      const start = timerStartAt ? new Date(timerStartAt).getTime() : now;
      const timeTaken = Math.max(0, now - start);
      const duration = timerSeconds * 1000;
      
      // Linear progressive scoring: 1000 -> 100
      const progress = Math.min(1, timeTaken / duration);
      const points = Math.max(100, Math.round(1000 - (900 * progress)));
      
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
          const difficultyParam = settings.difficulty || 'easy';
          
          // Fetch ALL logos at once for the whole game
          const data = await fetch(`/api/games/logo?count=${totalRounds}`);
          const logos = await data.json();
          
          if (!logos || logos.length === 0) {
              toast.error("Erreur lors du chargement des logos");
              return;
          }
          
          // Store queue in game state
          const queue = logos.slice(1); // All except first
          const nextLogo = logos[0]; // First logo for this round
          
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
                  queue: queue,
                  timer_start_at: new Date().toISOString(),
                  created_at: new Date().toISOString()
              }, { onConflict: 'room_id' });
              
              await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          } else {
              // Next Round - use queue
              const queue = game.queue || [];
              const nextLogoFromQueue = queue[0];
              const newQueue = queue.slice(1);
              
              await supabase.from('logo_players').update({
                  has_found: false,
                  find_time_ms: 0,
                  last_guess: null
              }).eq('room_id', roomId);
              
              await supabase.from('logo_games').update({
                  phase: 'playing',
                  current_logo: nextLogoFromQueue,
                  queue: newQueue,
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
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('logo_games').delete().eq('room_id', roomId);
      await supabase.from('logo_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
  };

  // --- RENDER ---
  
  return (
      <GameLayout
          isConnected={isConnected}
          gameTitle="LogoGuessr"
          roundCount={currentRound}
          maxRounds={totalRounds}
          timer={timeLeft.toString()}
          players={playersMap}
          timeLeft={timeLeft}
          voteToLobby={<VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} />}
      >
          {/* Setup Phase */}
          {currentPhase === 'setup' && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
                  <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                      <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform rotate-3">
                          <Image className="w-16 h-16 text-accent-secondary" />
                      </div>
                      
                      <div className="text-center space-y-2 mb-8">
                          <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">
                              Logo <span className="text-accent-secondary">Guessr</span>
                          </h2>
                          <p className="text-tx-secondary font-bold">
                              Les logos apparaîtront progressivement. Soyez le plus rapide à deviner la marque !
                          </p>
                      </div>
                      
                      {isHost ? (
                          <button 
                              onClick={startRound} 
                              className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-secondary text-brand-bg hover:bg-brand-inner hover:text-accent-secondary shadow-brutal"
                          >
                              COMMENCER LA PARTIE
                          </button>
                      ) : (
                          <div className="flex items-center justify-center gap-4 bg-brand-inner border-4 border-brand-border px-8 py-4 rounded-2xl shadow-brutal w-full">
                              <Loader2 className="w-6 h-6 animate-spin text-accent-secondary" />
                              <span className="font-display font-black text-tx-base tracking-wider uppercase">En attente de l'hôte...</span>
                          </div>
                      )}
                  </div>
              </div>
          )}

          {/* Playing Phase */}
          {currentPhase === 'playing' && (
              <div key={game.current_round} className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto gap-8 p-4 animate-in fade-in duration-300">
                  {/* Logo Display */}
                  <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-brand-inner rounded-[32px] shadow-brutal flex items-center justify-center p-4 border-4 border-brand-border overflow-hidden min-h-[16rem]">
                      {currentLogo && !logoError ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                              {difficulty === 'hard' ? (
                                  <canvas 
                                      ref={pixelCanvasRef}
                                      className="w-full h-full"
                                      style={{ imageRendering: 'pixelated' }}
                                  />
                              ) : difficulty === 'medium' ? (
                                  <canvas 
                                      ref={tileCanvasRef}
                                      className="w-full h-full"
                                  />
                              ) : (
                                  <img 
                                      key={currentLogo.domain || currentRound}
                                      src={currentLogoUrl || getLogoUrl(currentLogo.domain)} 
                                      alt="Logo mystère" 
                                      draggable={false}
                                      loading="eager"
                                      onError={() => setLogoError(true)}
                                      className="select-none w-full h-full object-contain"
                                      style={{
                                          filter: `blur(${blurLevel}px)`,
                                      }}
                                  />
                              )}
                          </div>
                      ) : (
                          <div 
                              className="w-32 h-32 rounded-2xl flex items-center justify-center border-4 border-brand-border shadow-inner"
                              style={{ backgroundColor: currentLogo ? getPlaceholderColor(currentLogo.domain) : '#1E1E28' }}
                          >
                              <span className="font-display text-5xl font-black text-white">
                                  {currentLogo ? getInitials(currentLogo.name) : '?'}
                              </span>
                          </div>
                      )}
                  </div>

                  {/* Input Area */}
                  <div className="w-full space-y-4">
                      <form onSubmit={(e) => { e.preventDefault(); handleSubmitGuess(); }} className="flex gap-3">
                          <input
                              type="text"
                              value={userGuess}
                              onChange={(e) => setUserGuess(e.target.value)}
                              disabled={inputDisabled}
                              placeholder={hasFound ? "Bravo ! Vous avez trouvé." : "Tapez le nom de la marque..."}
                              className={cn(
                                  "flex-1 h-16 text-2xl font-bold text-center rounded-2xl border-4 transition-all shadow-brutal outline-none disabled:opacity-50",
                                  hasFound 
                                  ? "bg-accent-success/20 border-accent-success text-accent-success placeholder:text-accent-success" 
                                  : "bg-brand-inner border-brand-border text-tx-base placeholder:text-tx-muted focus:border-tx-base"
                              )}
                              autoFocus
                          />
                          <button 
                              type="submit" 
                              disabled={inputDisabled || !userGuess.trim()}
                              className={cn(
                                  "h-16 w-20 flex items-center justify-center rounded-2xl border-4 border-brand-border shadow-brutal transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                  hasFound ? "bg-brand-inner text-tx-muted" : "bg-accent-secondary hover:bg-tx-base text-brand-bg"
                              )}
                          >
                              <Send className="w-6 h-6" />
                          </button>
                      </form>
                      
                      <div className="text-center text-sm font-bold uppercase tracking-widest text-tx-secondary">
                          {hasFound ? (
                              <span className="text-accent-success">Marque trouvée !</span>
                          ) : (
                              <span>Devinez la marque le plus vite possible !</span>
                          )}
                      </div>
                  </div>
              </div>
          )}

          {/* Round Results Phase */}
          {currentPhase === 'round_results' && (
              <div className="flex flex-col items-center justify-center h-full w-full gap-8 animate-in zoom-in p-4">
                  <div className="w-48 h-48 bg-white rounded-[32px] shadow-brutal flex items-center justify-center p-4 border-4 border-accent-success overflow-hidden transform rotate-2">
                      {currentLogo && !logoError ? (
                          <img 
                              src={currentLogoUrl || getLogoUrl(currentLogo.domain)} 
                              alt="Logo" 
                              className="w-full h-full object-contain drop-shadow-md"
                              onError={() => setLogoError(true)}
                          />
                      ) : (
                          <div 
                              className="w-32 h-32 rounded-2xl flex items-center justify-center"
                              style={{ backgroundColor: currentLogo ? getPlaceholderColor(currentLogo.domain) : '#1E1E28' }}
                          >
                              <span className="font-display text-4xl font-black text-white">
                                  {currentLogo ? getInitials(currentLogo.name) : '?'}
                              </span>
                          </div>
                      )}
                  </div>
                  
                  <div className="text-center bg-brand-card px-10 py-6 rounded-3xl border-4 border-brand-border shadow-brutal">
                      <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">
                          {currentLogo?.name}
                      </h2>
                  </div>

                  {/* Winners List */}
                  <div className="w-full max-w-md gap-3 flex flex-col">
                      <h3 className="text-sm font-black text-tx-secondary uppercase tracking-widest mb-2 text-center">Joueurs ayant trouvé</h3>
                      {gamePlayers
                          .filter((p: any) => p.has_found)
                          .sort((a: any, b: any) => a.find_time_ms - b.find_time_ms)
                          .map((p: any, index: number) => {
                              const playerInfo = players.find(pl => pl.id === p.player_id);
                              return (
                                  <div key={p.player_id} className="flex items-center justify-between bg-accent-success/10 p-4 rounded-2xl border-4 border-accent-success shadow-sm">
                                      <div className="flex items-center gap-4">
                                          <div className="font-display font-black text-xl text-accent-success">#{index + 1}</div>
                                          <div className="font-display font-black text-lg text-tx-base">{playerInfo?.name}</div>
                                      </div>
                                      <div className="font-bold font-mono text-accent-success bg-brand-inner px-3 py-1 rounded-md border-2 border-accent-success/50">
                                          {(p.find_time_ms / 1000).toFixed(2)}s
                                      </div>
                                  </div>
                              );
                          })}
                      {gamePlayers.filter((p: any) => p.has_found).length === 0 && (
                          <div className="text-center text-tx-muted font-bold uppercase tracking-widest">Personne n'a trouvé...</div>
                      )}
                  </div>
              </div>
          )}

          {/* Podium Phase */}
          {currentPhase === 'podium' && (
              <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                  <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                      <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                          <Trophy className="w-16 h-16 text-accent-secondary" />
                      </div>
                      <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                      
                      <div className="w-full space-y-4 mb-8">
                          {[...players].sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name)).map((p, i) => (
                              <div key={p.id} className={cn(
                                  "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                  i === 0 ? "bg-accent-secondary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                              )}>
                                  {/* Badges */}
                                  {i === 0 && (
                                      <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                          Expert Marketing
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
                                              {i === 0 ? '🦅 Œil de Lynx' : '📺 Consommateur'}
                                          </span>
                                      </div>
                                  </div>
                                  <span className={cn(
                                      "text-3xl font-display font-black",
                                      i === 0 ? "text-brand-bg" : "text-accent-secondary"
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
