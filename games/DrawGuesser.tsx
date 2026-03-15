'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import { Trophy, Clock, PenTool, CheckCircle, Eraser, Eye, EyeOff, Trash2, Home, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

import { vibrate, HAPTIC } from '@/lib/haptic';

interface DrawGuesserProps {
  roomCode: string;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500', '#800080',
  '#FF69B4', '#00CED1', '#8B4513', '#808080', '#FF6347', '#40E0D0', '#EEE8AA', '#98FB98'
];
const SIZES = [4, 8, 12, 18];

interface StrokePoint {
  x: number;
  y: number;
}

interface Stroke {
  points: StrokePoint[];
  color: string;
  size: number;
}

export default function DrawGuesser({ roomCode }: DrawGuesserProps) {
  const router = useRouter();
  
  // --- SYNC ---
  const {
    gameState,
    isHost,
    players,
    playerId,
    draw,
    setPlayerReady,
    resetAllPlayersReady,
    roomId,
    lastEvent,
    broadcast
  } = useGameSync(roomCode, 'draw');

  // --- DERIVED STATE ---
  const game = draw?.game || {};
  const gamePlayers = draw?.players || [];
  
  const currentPhase = game.phase || 'setup';
  const currentRound = game.current_round || 1;
  const currentWord = game.current_word;
  const currentDrawerId = game.current_drawer_id;
  const isDrawer = playerId === currentDrawerId;
  
  const getDrawerName = () => {
      const drawer = players.find(p => p.id === currentDrawerId);
      return drawer?.name || 'Unknown';
  };
  
  const timerStartAt = game.timer_start_at;
  const timerSeconds = game.timer_seconds || 90;
  
  // Settings
  const settings = gameState?.settings || {};
  const totalRounds = Number(settings.rounds || 5);
  // Difficulty handled by API

  // Local State
  const [timeLeft, setTimeLeft] = useState(0);
  const [userGuess, setUserGuess] = useState('');
  const [hasGuessed, setHasGuessed] = useState(false);
  const [guessRank, setGuessRank] = useState(0);
  
  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(8);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const [revealedWord, setRevealedWord] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const strokeBatch = useRef<StrokePoint[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDrawingRef = useRef(false);
  const strokesLoaded = useRef(false);

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
              setGuessRank(myPlayer.guess_rank);
          }
      }
  }, [gamePlayers, playerId]);

  // Reset local state on new round
  useEffect(() => {
      if (currentPhase === 'playing') {
          setUserGuess('');
          setHasGuessed(false);
          setGuessRank(0);
          setStrokes([]);
          strokesLoaded.current = false;
          clearCanvasLocal();
      }
  }, [currentRound, currentPhase]);

  // Load strokes from Supabase when drawer starts or when joining
  useEffect(() => {
      if (!roomId || currentPhase !== 'playing' || strokesLoaded.current) return;
      
      const loadStrokes = async () => {
          const { data } = await supabase
              .from('draw_strokes')
              .select('strokes_data')
              .eq('room_id', roomId)
              .eq('round', currentRound)
              .single();
          
          if (data?.strokes_data && Array.isArray(data.strokes_data)) {
              setStrokes(data.strokes_data);
              redrawCanvas(data.strokes_data);
          }
          strokesLoaded.current = true;
      };
      
      loadStrokes();
  }, [roomId, currentPhase, currentRound]);

  // Handle Incoming Draw Events
  useEffect(() => {
      if (!lastEvent || !canvasRef.current) return;
      
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      if (lastEvent.type === 'draw_batch') {
          const batch = lastEvent.payload as Stroke;
          setStrokes(prev => {
              const newStrokes = [...prev, batch];
              drawStrokeOnCanvas(ctx, batch);
              return newStrokes;
          });
      } else if (lastEvent.type === 'clear_canvas') {
          clearCanvasLocal();
          setStrokes([]);
      } else if (lastEvent.type === 'player_found') {
          const { playerName } = lastEvent.payload;
          toast.success(`✅ ${playerName} a trouvé !`);
      }
  }, [lastEvent]);

  // --- CANVAS HELPERS ---
  const clearCanvasLocal = () => {
      const ctx = canvasRef.current?.getContext('2d');
      const parent = canvasRef.current?.parentElement;
      if (ctx && canvasRef.current && parent) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.restore();
      }
  };

  const drawStrokeOnCanvas = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 2) return;
      const canvas = ctx.canvas;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * canvas.width, firstPoint.y * canvas.height);
      
      for (let i = 1; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
      }
      ctx.stroke();
  };

  const redrawCanvas = (strokesToDraw: Stroke[]) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !canvasRef.current) return;
      
      clearCanvasLocal();
      
      for (const stroke of strokesToDraw) {
          drawStrokeOnCanvas(ctx, stroke);
      }
  };

  // Save strokes to Supabase
  const saveStrokesToSupabase = async (newStrokes: Stroke[]) => {
      if (!roomId || !isDrawer) return;
      await supabase.from('draw_strokes').upsert({
          room_id: roomId,
          round: currentRound,
          strokes_data: newStrokes
      }, { onConflict: 'room_id,round' });
  };

  // Broadcast batched strokes
  const broadcastBatch = () => {
      if (strokeBatch.current.length < 2 || !broadcast) return;
      
      const batch: Stroke = {
          points: [...strokeBatch.current],
          color,
          size
      };
      
      broadcast('draw_batch', batch);
      strokeBatch.current = [];
  };
  const getCoords = (e: any) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
          x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      };
  };

  const startDrawing = (e: any) => {
      if (!isDrawer || currentPhase !== 'playing') return;
      e.preventDefault();
      isDrawing.current = true;
      isDrawingRef.current = true;
      const { x, y } = getCoords(e);
      lastPos.current = { x, y };
      
      currentStroke.current = {
          points: [{ x, y }],
          color,
          size
      };
      strokeBatch.current = [{ x, y }];
  };

  const drawStroke = (e: any) => {
      if (!isDrawing.current || !isDrawer || !canvasRef.current) return;
      e.preventDefault();
      
      const { x, y } = getCoords(e);
      const lastX = lastPos.current.x;
      const lastY = lastPos.current.y;
      
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && currentStroke.current) {
          currentStroke.current.points.push({ x, y });
          strokeBatch.current.push({ x, y });
          
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(lastX * canvasRef.current.width, lastY * canvasRef.current.height);
          ctx.lineTo(x * canvasRef.current.width, y * canvasRef.current.height);
          ctx.stroke();
      }
      
      lastPos.current = { x, y };
      
      if (strokeBatch.current.length >= 10) {
          broadcastBatch();
      }
  };

  const stopDrawing = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      isDrawingRef.current = false;
      
      if (currentStroke.current && currentStroke.current.points.length >= 2) {
          const newStrokes = [...strokes, currentStroke.current];
          setStrokes(newStrokes);
          saveStrokesToSupabase(newStrokes);
      }
      
      if (strokeBatch.current.length >= 2) {
          broadcastBatch();
      }
      
      currentStroke.current = null;
      strokeBatch.current = [];
  };

  const clearCanvas = () => {
      if (!isDrawer && !isHost) return;
      clearCanvasLocal();
      setStrokes([]);
      if (broadcast) broadcast('clear_canvas', {});
      if (isDrawer && roomId) {
          saveStrokesToSupabase([]);
      }
  };

  // --- HOST LOGIC ---
  useEffect(() => {
      if (!isHost || !roomId) return;

      const manageGame = async () => {
          // 1. Playing -> Round Results (Time up or All Guessers Found)
          if (currentPhase === 'playing') {
              const timeIsUp = timeLeft === 0 && timerStartAt && (Date.now() > new Date(timerStartAt).getTime() + timerSeconds * 1000);
              const guessers = players.filter(p => p.id !== currentDrawerId);
              const allFound = guessers.length > 0 && gamePlayers.filter((p: any) => p.has_guessed && p.player_id !== currentDrawerId).length >= guessers.length;

              if (timeIsUp || allFound) {
                  // Calculate Scores for Drawer
                  const foundCount = gamePlayers.filter((p: any) => p.has_guessed && p.player_id !== currentDrawerId).length;
                  let drawerPoints = 0;
                  if (foundCount > 0) drawerPoints = 500;
                  if (foundCount === guessers.length && guessers.length > 0) drawerPoints = 800;

                  if (drawerPoints > 0) {
                      // Fetch current score
                      const { data: dData } = await supabase.from('draw_players').select('score').eq('room_id', roomId).eq('player_id', currentDrawerId).single();
                      await supabase.from('draw_players').update({ score: (dData?.score || 0) + drawerPoints }).eq('room_id', roomId).eq('player_id', currentDrawerId);
                  }

                  // Move to Results
                  await supabase.from('draw_games').update({
                      phase: 'round_results',
                      timer_start_at: null
                  }).eq('room_id', roomId);
                  
                  // Auto Next Round after 5s
                  setTimeout(async () => {
                      await nextRound();
                  }, 5000);
              }
          }
      };

      manageGame();
  }, [isHost, roomId, currentPhase, timeLeft, timerStartAt, timerSeconds, players.length, gamePlayers, currentDrawerId]);

  // --- ACTIONS ---

  const startNewGame = async () => {
      if (!isHost || !roomId) return;

      try {
          toast.loading("Préparation des crayons...");
          
          // Fetch words
          const count = totalRounds + 5; // Extra buffer
          const difficulty = settings.difficulty || 'mix';
          
          const res = await fetch(`/api/games/draw?count=${count}&difficulty=${difficulty}`);
          if (!res.ok) throw new Error("API Error");
          const words = await res.json();
          
          if (!words || words.length === 0) {
              toast.error("Aucun mot trouvé");
              return;
          }

          const firstWord = words[0];
          const queue = words.slice(1);
          
          const firstDrawerId = players[0].id; // Simple rotation logic start

          // Reset Players
          const playerInserts = players.map(p => ({
              room_id: roomId,
              player_id: p.id,
              score: 0,
              has_guessed: false,
              guess_rank: 0,
              guess_time_ms: 0
          }));
          
          await supabase.from('draw_players').delete().eq('room_id', roomId);
          await supabase.from('draw_players').insert(playerInserts);

          // Update Game
          await supabase.from('draw_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              total_rounds: totalRounds,
              timer_seconds: Number(settings.time || 90),
              timer_start_at: new Date().toISOString(),
              current_word: firstWord,
              current_drawer_id: firstDrawerId,
              queue: queue,
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          toast.dismiss();
          toast.success("À vos pinceaux !");

      } catch (e) {
          console.error(e);
          toast.error("Erreur au démarrage");
      }
  };

  const nextRound = async () => {
      if (!isHost || !roomId) return;

      const queue = game.queue || [];
      const currentRound = game.current_round || 1;

      if (queue.length === 0 || currentRound >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('draw_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextWord = queue[0];
      const nextQueue = queue.slice(1);
      
      // Determine next drawer
      const currentIndex = players.findIndex(p => p.id === currentDrawerId);
      const nextIndex = (currentIndex + 1) % players.length;
      const nextDrawerId = players[nextIndex].id;

      // Reset players guess state
      await supabase.from('draw_players').update({
          has_guessed: false,
          guess_rank: 0,
          guess_time_ms: 0
      }).eq('room_id', roomId);

      // Start next round
      await supabase.from('draw_games').update({
          phase: 'playing',
          current_round: currentRound + 1,
          current_word: nextWord,
          current_drawer_id: nextDrawerId,
          queue: nextQueue,
          timer_start_at: new Date().toISOString()
      }).eq('room_id', roomId);
      
      // Clear canvas broadcast
      if (broadcast) broadcast('clear_canvas', {});
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || isDrawer || currentPhase !== 'playing') return;
      if (!currentWord) return;
      
      // Filter numbers
      if (/\d/.test(userGuess)) {
          toast.error("Pas de chiffres !");
          return;
      }

      const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const userGuessNorm = normalize(userGuess);
      const correctWordNorm = normalize(currentWord.word);
      
      // Levenshtein
      const dist = levenshteinDistance(userGuessNorm, correctWordNorm);
      const threshold = correctWordNorm.length > 5 ? 2 : 1;
      const isCorrect = dist <= threshold;

      if (isCorrect) {
          const now = Date.now();
          const start = new Date(timerStartAt).getTime();
          const timeTaken = Math.max(0, now - start); // ms

          // Calculate Score (1000 -> 100)
          const maxTime = timerSeconds * 1000;
          // Linear decay from 1000 to 100
          // If < 5s -> 1000
          let points = 100;
          if (timeTaken <= 5000) {
              points = 1000;
          } else {
              const factor = 1 - ((timeTaken - 5000) / (maxTime - 5000));
              points = Math.max(100, Math.round(100 + 900 * Math.max(0, factor)));
          }

          // Fetch current rank
          const { count } = await supabase.from('draw_players').select('*', { count: 'exact', head: true }).eq('room_id', roomId).eq('has_guessed', true);
          const rank = (count || 0) + 1;

          setHasGuessed(true);
          setGuessRank(rank);
          vibrate(HAPTIC.SUCCESS);
          toast.success(`Trouvé ! +${points} pts`);

          // Update DB
          const { data: pData } = await supabase.from('draw_players').select('score').eq('room_id', roomId).eq('player_id', playerId).single();
          await supabase.from('draw_players').update({
              score: (pData?.score || 0) + points,
              has_guessed: true,
              guess_rank: rank,
              guess_time_ms: timeTaken
          }).eq('room_id', roomId).eq('player_id', playerId);

          // Broadcast found
          const myName = players.find(p => p.id === playerId)?.name || 'Quelqu\'un';
          if (broadcast) broadcast('player_found', { playerName: myName });
      } else {
          // Check closeness for "Chauffe !" message?
          if (dist <= threshold + 2) {
              vibrate(HAPTIC.WARNING);
              toast('Chauffe !', { icon: '🔥' });
          } else {
              vibrate(HAPTIC.ERROR);
              // Shake
          }
      }
      setUserGuess(''); // Clear input for retry
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('draw_games').delete().eq('room_id', roomId);
      await supabase.from('draw_players').delete().eq('room_id', roomId);
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
          return { ...p, score: gp?.score || 0 };
      }).sort((a, b) => b.score - a.score);
  }, [players, gamePlayers]);

  // Handle Resize
  useEffect(() => {
      const handleResize = () => {
          if (canvasRef.current) {
              const parent = canvasRef.current.parentElement;
              if (parent) {
                  const scale = window.devicePixelRatio || 2;
                  const displayWidth = parent.clientWidth;
                  const displayHeight = parent.clientHeight;
                  
                  canvasRef.current.width = displayWidth * scale;
                  canvasRef.current.height = displayHeight * scale;
                  canvasRef.current.style.width = displayWidth + 'px';
                  canvasRef.current.style.height = displayHeight + 'px';
                  
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                      ctx.scale(scale, scale);
                      ctx.imageSmoothingEnabled = true;
                      ctx.imageSmoothingQuality = 'high';
                      ctx.lineCap = 'round';
                      ctx.lineJoin = 'round';
                      ctx.fillStyle = '#FFFFFF';
                      ctx.fillRect(0, 0, displayWidth, displayHeight);
                      
                      if (strokes.length > 0) {
                          redrawCanvas(strokes);
                      }
                  }
              }
          }
      };
      
      handleResize();
      window.addEventListener('resize', handleResize);
      const observer = new ResizeObserver(handleResize);
      if (canvasRef.current?.parentElement) {
          observer.observe(canvasRef.current.parentElement);
      }
      return () => {
          window.removeEventListener('resize', handleResize);
          observer.disconnect();
      };
  }, [strokes]);

  return (
    <GameLayout
      players={playersMap}
      roundCount={game.current_round || 0}
      maxRounds={game.total_rounds || totalRounds}
      timer={timeLeft > 0 ? `${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}` : '--:--'}
      gameTitle="DrawGuessr"
      gameStarted={currentPhase !== 'setup'}
      timeLeft={timeLeft}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)] relative">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-8 animate-in fade-in">
               <div className="relative">
                   <PenTool className="w-24 h-24 text-pink-400 animate-pulse" />
               </div>
               
               <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold text-[#F8FAFC]">Prêt à dessiner ?</h2>
                   <p className="text-gray-400">
                       Rounds : <span className="text-blue-400 font-bold">{totalRounds}</span> • 
                       Temps : <span className="text-purple-400 font-bold">{settings.time || 90}s</span>
                   </p>
               </div>

               {isHost ? (
                   <Button 
                       size="lg" 
                       onClick={startNewGame}
                        className="h-16 px-12 text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 shadow-[0_4px_0_0px_#020617] border border-[#334155] rounded-xl"
                   >
                       Lancer la partie
                   </Button>
               ) : (
                    <div className="flex items-center gap-3 bg-[#334155] px-6 py-3 rounded-full border border-[#475569]">
                        <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                        <span className="text-[#F8FAFC]">En attente de l'artiste...</span>
                   </div>
               )}
            </div>
        )}

        {/* PHASE: PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && (
            <div className="flex flex-col w-full h-full gap-4">
                
                {/* TOP: Word Reveal Card */}
                <div className="flex-shrink-0">
                    {isDrawer && currentPhase === 'playing' && (
                        <div className="bg-[#0F172A] p-4 rounded-2xl border border-[#334155] shadow-lg">
                            <div className="flex flex-col items-center gap-3">
                                {revealedWord ? (
                                    <div className="bg-[#334155] px-6 py-3 rounded-xl border border-[#475569] w-full">
                                        <span className="block text-xs text-[#94A3B8] uppercase tracking-widest text-center">Mot à dessiner</span>
                                        <span className="text-2xl font-bold text-[#F8FAFC] block text-center">{currentWord?.word}</span>
                                    </div>
                                ) : (
                                    <p className="text-[#94A3B8] text-sm">Maintenir le bouton pour voir le mot</p>
                                )}
                                <button
                                    className="w-full bg-[#334155] hover:bg-[#475569] active:bg-[#475569] border border-[#475569] rounded-xl py-3 transition-colors select-none touch-none"
                                    onMouseDown={(e) => { e.preventDefault(); setRevealedWord(true); }}
                                    onMouseUp={(e) => { e.preventDefault(); setRevealedWord(false); }}
                                    onMouseLeave={() => setRevealedWord(false)}
                                    onTouchStart={(e) => { e.preventDefault(); setRevealedWord(true); }}
                                    onTouchEnd={(e) => { e.preventDefault(); setRevealedWord(false); }}
                                >
                                    <Eye className="w-6 h-6 mx-auto text-[#F8FAFC]" />
                                </button>
                            </div>
                        </div>
                    )}
                    {!isDrawer && currentPhase === 'playing' && (
                        <div className="bg-[#0F172A] px-6 py-3 rounded-2xl border border-[#334155] shadow-lg flex items-center justify-center gap-3">
                            <PenTool className="w-5 h-5 text-pink-400" />
                            <span className="text-[#F8FAFC] font-bold">{getDrawerName()} dessine</span>
                        </div>
                    )}
                    {currentPhase === 'round_results' && (
                        <div className="bg-[#334155] px-6 py-3 rounded-2xl border border-[#475569] shadow-[0_4px_0_0px_#020617]">
                            <span className="block text-xs text-[#94A3B8] uppercase tracking-widest text-center">Le mot était</span>
                            <span className="text-xl font-bold text-[#F8FAFC] block text-center">{currentWord?.word}</span>
                        </div>
                    )}
                </div>

                {/* MIDDLE: Canvas */}
                <div className="flex-1 bg-[#1E293B] rounded-xl shadow-lg overflow-hidden relative touch-none border-2 border-[#334155] min-h-[200px]">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={startDrawing}
                        onMouseMove={drawStroke}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={drawStroke}
                        onTouchEnd={stopDrawing}
                        className="w-full h-full cursor-crosshair"
                    />
                    
                    {/* TOOLBAR (Drawer Only) */}
                    {isDrawer && currentPhase === 'playing' && (
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-[#0F172A]/95 backdrop-blur px-3 py-2 rounded-xl flex items-center gap-3 shadow-lg border border-[#334155] max-w-[95%] overflow-x-auto">
                            <div className="flex gap-1.5 flex-wrap justify-center max-w-[180px]">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0 ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="w-px h-6 bg-[#334155]" />
                            <div className="flex gap-1 items-center">
                                {SIZES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSize(s)}
                                        className={`rounded-full bg-[#475569] flex items-center justify-center transition-all ${size === s ? 'ring-2 ring-white' : ''}`}
                                        style={{ width: s + 10, height: s + 10, minWidth: s + 10, minHeight: s + 10 }}
                                    >
                                        <div className="rounded-full bg-white" style={{ width: s, height: s }} />
                                    </button>
                                ))}
                            </div>
                            <div className="w-px h-6 bg-[#334155]" />
                            <button onClick={() => setColor('#FFFFFF')} className={`p-1.5 rounded hover:bg-[#334155] ${color === '#FFFFFF' ? 'bg-[#475569]' : ''}`}>
                                <Eraser className="w-4 h-4 text-[#F8FAFC]" />
                            </button>
                            <button onClick={clearCanvas} className="p-1.5 rounded hover:bg-red-900/50 text-red-400">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* BOTTOM: Answer Input (Guesser Only) */}
                {!isDrawer && currentPhase === 'playing' && !hasGuessed && (
                    <div className="flex-shrink-0 pb-2">
                        <form onSubmit={submitGuess} className="flex gap-2">
                            <Input 
                                placeholder="Devinez le mot..." 
                                value={userGuess}
                                onChange={e => setUserGuess(e.target.value)}
                                className="h-12 text-base"
                                autoFocus
                            />
                            <Button type="submit" variant="primary" className="h-12 px-6">
                                <Send className="w-5 h-5" />
                            </Button>
                        </form>
                    </div>
                )}
            </div>
        )}

        {/* PHASE: PODIUM */}
        {currentPhase === 'podium' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                <Trophy className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
                <h2 className="text-4xl font-black text-[#F8FAFC] mb-8">Classement Final</h2>
                
                <div className="w-full space-y-4 mb-8">
                    {sortedPlayers.map((p, i) => (
                        <div key={p.id} className={`relative flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
                            i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.2)] scale-105 z-10' : 
                            i === 1 ? 'bg-[#1E293B] border-[#475569]' : 
                            i === 2 ? 'bg-[#1E293B]/70 border-[#334155]' : 'opacity-60 border-transparent'
                        }`}>
                            {/* Badges */}
                            {i === 0 && (
                                <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg transform rotate-12">
                                    Picasso
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
                                        {i === 0 ? '🎨 Artiste' : '✏️ Gribouilleur'}
                                    </span>
                                </div>
                            </div>
                            <span className="text-3xl font-mono font-black text-pink-400">{p.score}</span>
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

      </div>
    </GameLayout>
  );
}
