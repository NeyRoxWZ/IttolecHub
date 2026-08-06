'use client';

import { useState, useEffect, useMemo, useRef } from 'react';


import { useGameSync } from '@/hooks/useGameSync';
import GameLayout from './components/GameLayout';
import VoteToLobby from './components/VoteToLobby';
import { Trophy, Clock, PenTool, CheckCircle, Eraser, Eye, EyeOff, Trash2, Home, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
  strokeId: string;
  sequence: number;
  points: StrokePoint[];
  color: string;
  size: number;
  isEnd: boolean;
}

interface StrokeBatch {
  strokeId: string;
  sequence: number;
  points: StrokePoint[];
  color: string;
  size: number;
  isEnd: boolean;
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
  const currentRoundId = game.round_id || null;
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
  const isHoldingRef = useRef(false);
  const revealedWordRef = useRef(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<Stroke | null>(null);
  const strokeBatch = useRef<StrokePoint[]>([]);
  const batchTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDrawingRef = useRef(false);
  const strokesLoaded = useRef(false);
  
  // Round ID system
  const [roundId, setRoundId] = useState<string | null>(null);
  const currentStrokeId = useRef<string>('');
  const strokeSequence = useRef(0);
  
  // Render queue for receiving strokes
  const renderQueue = useRef<StrokeBatch[]>([]);
  const isProcessingQueue = useRef(false);
  const receivedStrokes = useRef<Map<string, StrokeBatch[]>>(new Map());

  // --- EFFECTS ---

  // Cleanup stray batch interval on unmount (e.g. leaving mid-stroke)
  useEffect(() => {
    return () => {
        if (batchTimeout.current) clearInterval(batchTimeout.current);
    };
  }, []);

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
          setRoundId(currentRoundId);
          strokesLoaded.current = false;
          renderQueue.current = [];
          receivedStrokes.current.clear();
          clearCanvasLocal();
      }
  }, [currentRound, currentPhase, currentRoundId]);

  // Load strokes from Supabase when drawer starts or when joining
  useEffect(() => {
      if (!roomId || currentPhase !== 'playing' || strokesLoaded.current || !currentRoundId) return;
      
      const loadStrokes = async () => {
          const { data } = await supabase
              .from('draw_strokes')
              .select('strokes_data')
              .eq('room_id', roomId)
              .eq('round_id', currentRoundId)
              .single();
          
          if (data?.strokes_data && Array.isArray(data.strokes_data)) {
              setStrokes(data.strokes_data);
              redrawCanvas(data.strokes_data);
          }
          strokesLoaded.current = true;
      };
      
      loadStrokes();
  }, [roomId, currentPhase, currentRound, currentRoundId]);

  // Process render queue with requestAnimationFrame
  const processRenderQueue = () => {
      if (renderQueue.current.length === 0) {
          isProcessingQueue.current = false;
          return;
      }
      
      isProcessingQueue.current = true;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) {
          isProcessingQueue.current = false;
          return;
      }
      
      // Process next batch
      const batch = renderQueue.current.shift();
      if (batch) {
          drawBatchOnCanvas(ctx, batch);
          requestAnimationFrame(processRenderQueue);
      }
  };

  const drawBatchOnCanvas = (ctx: CanvasRenderingContext2D, batch: StrokeBatch) => {
      const canvas = ctx.canvas;
      const parent = canvas.parentElement;
      const displayWidth = parent?.clientWidth || parseFloat(canvas.style.width) || canvas.width;
      const displayHeight = parent?.clientHeight || parseFloat(canvas.style.height) || canvas.height;
      
      ctx.beginPath();
      ctx.strokeStyle = batch.color;
      ctx.lineWidth = batch.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (batch.points.length === 0) return;
      
      // Get previous strokes to connect
      const existingBatches = receivedStrokes.current.get(batch.strokeId) || [];
      const isFirstBatch = existingBatches.length === 0;
      
      // Connect to last point of previous batch if exists
      if (!isFirstBatch && existingBatches.length > 0) {
          const lastBatch = existingBatches[existingBatches.length - 1];
          if (lastBatch.points.length > 0) {
              const lastPoint = lastBatch.points[lastBatch.points.length - 1];
              ctx.moveTo(lastPoint.x * displayWidth, lastPoint.y * displayHeight);
          }
      } else {
          ctx.moveTo(batch.points[0].x * displayWidth, batch.points[0].y * displayHeight);
      }
      
      for (let i = 0; i < batch.points.length; i++) {
          const point = batch.points[i];
          ctx.lineTo(point.x * displayWidth, point.y * displayHeight);
      }
      ctx.stroke();
      
      // Store batch
      existingBatches.push(batch);
      receivedStrokes.current.set(batch.strokeId, existingBatches);
      
      // Update strokes state when stroke is complete
      if (batch.isEnd) {
          const allPoints: StrokePoint[] = [];
          for (const b of existingBatches) {
              allPoints.push(...b.points);
          }
          const completeStroke: Stroke = {
              strokeId: batch.strokeId,
              sequence: batch.sequence,
              points: allPoints,
              color: batch.color,
              size: batch.size,
              isEnd: true
          };
          setStrokes(prev => [...prev, completeStroke]);
      }
  };

  // Handle Incoming Draw Events
  useEffect(() => {
      if (!lastEvent || !canvasRef.current) return;

      if (lastEvent.type === 'draw_batch') {
          const batch = lastEvent.payload as StrokeBatch;
          
          // Verify round ID matches
          if (currentRoundId && roundId && roundId !== currentRoundId) {
              return; // Ignore strokes from old round
          }
          
          // Add to render queue
          renderQueue.current.push(batch);
          
          // Start processing if not already
          if (!isProcessingQueue.current) {
              isProcessingQueue.current = true;
              requestAnimationFrame(processRenderQueue);
          }
      } else if (lastEvent.type === 'clear_canvas') {
          clearCanvasLocal();
          setStrokes([]);
          renderQueue.current = [];
          receivedStrokes.current.clear();
      } else if (lastEvent.type === 'player_found') {
          const { playerName } = lastEvent.payload;
          toast.success(`✅ ${playerName} a trouvé !`);
      } else if (lastEvent.type === 'new_round') {
          // Reset for new round
          setRoundId(lastEvent.payload.roundId);
          clearCanvasLocal();
          setStrokes([]);
          renderQueue.current = [];
          receivedStrokes.current.clear();
          strokesLoaded.current = false;
      }
  }, [lastEvent, roundId, currentRoundId]);

  // --- CANVAS HELPERS ---
  const clearCanvasLocal = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const parent = canvas?.parentElement;
      if (ctx && canvas && parent) {
          const displayWidth = parent.clientWidth;
          const displayHeight = parent.clientHeight;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, displayWidth, displayHeight);
          ctx.restore();
      }
  };

  const drawStrokeOnCanvas = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
      if (stroke.points.length < 1) return;
      const canvas = ctx.canvas;
      const parent = canvas.parentElement;
      const displayWidth = parent?.clientWidth || parseFloat(canvas.style.width) || canvas.width;
      const displayHeight = parent?.clientHeight || parseFloat(canvas.style.height) || canvas.height;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (stroke.points.length === 1) {
          const point = stroke.points[0];
          ctx.arc(point.x * displayWidth, point.y * displayHeight, stroke.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
          return;
      }
      
      const firstPoint = stroke.points[0];
      ctx.moveTo(firstPoint.x * displayWidth, firstPoint.y * displayHeight);
      
      for (let i = 1; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          ctx.lineTo(point.x * displayWidth, point.y * displayHeight);
      }
      ctx.stroke();
  };

  const drawStrokeOnCanvasWithConnection = (ctx: CanvasRenderingContext2D, previousStrokes: Stroke[], newBatch: Stroke) => {
      const canvas = ctx.canvas;
      const parent = canvas.parentElement;
      const displayWidth = parent?.clientWidth || parseFloat(canvas.style.width) || canvas.width;
      const displayHeight = parent?.clientHeight || parseFloat(canvas.style.height) || canvas.height;
      
      ctx.beginPath();
      ctx.strokeStyle = newBatch.color;
      ctx.lineWidth = newBatch.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Connect to last point of previous stroke if exists
      if (previousStrokes.length > 0) {
          const lastStroke = previousStrokes[previousStrokes.length - 1];
          if (lastStroke.points.length > 0) {
              const lastPoint = lastStroke.points[lastStroke.points.length - 1];
              ctx.moveTo(lastPoint.x * displayWidth, lastPoint.y * displayHeight);
          }
      } else if (newBatch.points.length > 0) {
          const firstPoint = newBatch.points[0];
          ctx.moveTo(firstPoint.x * displayWidth, firstPoint.y * displayHeight);
      }
      
      // Draw all points in the new batch
      for (let i = 0; i < newBatch.points.length; i++) {
          const point = newBatch.points[i];
          ctx.lineTo(point.x * displayWidth, point.y * displayHeight);
      }
      ctx.stroke();
  };

  const redrawCanvas = (strokesToDraw: Stroke[]) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      
      clearCanvasLocal();
      
      for (const stroke of strokesToDraw) {
          drawStrokeOnCanvas(ctx, stroke);
      }
  };

  // Save strokes to Supabase
  const saveStrokesToSupabase = async (newStrokes: Stroke[]) => {
      if (!roomId || !isDrawer || !currentRoundId) return;
      await supabase.from('draw_strokes').upsert({
          room_id: roomId,
          round_id: currentRoundId,
          round: currentRound,
          strokes_data: newStrokes
      }, { onConflict: 'room_id,round_id' });
  };

  // Broadcast batched strokes
  const broadcastBatch = (isEnd: boolean = false) => {
      if (strokeBatch.current.length < 1 || !broadcast) return;
      
      const batch: StrokeBatch = {
          strokeId: currentStrokeId.current,
          sequence: strokeSequence.current,
          points: [...strokeBatch.current],
          color,
          size,
          isEnd
      };
      
      broadcast('draw_batch', batch);
      strokeSequence.current++;
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
      
      // Generate new stroke ID
      currentStrokeId.current = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      strokeSequence.current = 0;
      
      currentStroke.current = {
          strokeId: currentStrokeId.current,
          sequence: 0,
          points: [{ x, y }],
          color,
          size,
          isEnd: false
      };
      strokeBatch.current = [{ x, y }];

      // Start periodic broadcast for the duration of this stroke. This is
      // started/stopped explicitly (not via a useEffect keyed on a ref)
      // because refs don't trigger effect re-runs — a previous version kept
      // this in an effect depending on isDrawing.current, so the interval
      // was only ever evaluated once at mount (before drawing started) and
      // never actually ran, meaning viewers only saw the whole stroke pop
      // in at once when the drawer lifted their finger.
      if (batchTimeout.current) clearInterval(batchTimeout.current);
      batchTimeout.current = setInterval(() => {
          if (strokeBatch.current.length > 0) {
              broadcastBatch(false);
          }
      }, 40);
  };

  const drawStroke = (e: any) => {
      if (!isDrawing.current || !isDrawer || !canvasRef.current) return;
      e.preventDefault();
      
      const { x, y } = getCoords(e);
      const lastX = lastPos.current.x;
      const lastY = lastPos.current.y;
      
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      const displayWidth = parent?.clientWidth || parseFloat(canvas.style.width) || canvas.width;
      const displayHeight = parent?.clientHeight || parseFloat(canvas.style.height) || canvas.height;
      
      const ctx = canvas.getContext('2d');
      if (ctx && currentStroke.current) {
          currentStroke.current.points.push({ x, y });
          strokeBatch.current.push({ x, y });
          
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(lastX * displayWidth, lastY * displayHeight);
          ctx.lineTo(x * displayWidth, y * displayHeight);
          ctx.stroke();
      }
      
      lastPos.current = { x, y };
  };

  const stopDrawing = () => {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      isDrawingRef.current = false;

      if (batchTimeout.current) {
          clearInterval(batchTimeout.current);
          batchTimeout.current = null;
      }

      // Send final batch with isEnd: true
      if (strokeBatch.current.length > 0) {
          broadcastBatch(true);
      }
      
      if (currentStroke.current && currentStroke.current.points.length >= 1) {
          const newStrokes = [...strokes, currentStroke.current];
          setStrokes(newStrokes);
          saveStrokesToSupabase(newStrokes);
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
          
          const firstDrawerId = players[0].id;
          
          // Generate round ID
          const roundId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
          
          // Clear old strokes
          await supabase.from('draw_strokes').delete().eq('room_id', roomId);

          // Update Game with round_id
          await supabase.from('draw_games').upsert({
              room_id: roomId,
              phase: 'playing',
              current_round: 1,
              round_id: roundId,
              total_rounds: totalRounds,
              timer_seconds: Number(settings.time || 90),
              timer_start_at: new Date().toISOString(),
              current_word: firstWord,
              current_drawer_id: firstDrawerId,
              queue: queue,
              created_at: new Date().toISOString()
          }, { onConflict: 'room_id' });

          await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
          setRoundId(roundId);
          
          // Broadcast new round
          if (broadcast) broadcast('new_round', { roundId });
          
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
      const currentRoundNum = game.current_round || 1;

      if (queue.length === 0 || currentRoundNum >= totalRounds) {
          // Game Over -> Podium
          await supabase.from('draw_games').update({
              phase: 'podium'
          }).eq('room_id', roomId);
          return;
      }

      const nextWord = queue[0];
      const nextQueue = queue.slice(1);
      
      // Generate new round ID
      const newRoundId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
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
      
      // Clear old strokes for this room
      await supabase.from('draw_strokes').delete().eq('room_id', roomId);

      // Start next round with new round_id
      await supabase.from('draw_games').update({
          phase: 'playing',
          current_round: currentRoundNum + 1,
          round_id: newRoundId,
          current_word: nextWord,
          current_drawer_id: nextDrawerId,
          queue: nextQueue,
          timer_start_at: new Date().toISOString()
      }).eq('room_id', roomId);
      
      // Update local state
      setRoundId(newRoundId);
      setStrokes([]);
      strokesLoaded.current = false;
      renderQueue.current = [];
      receivedStrokes.current.clear();
      
      // Broadcast new round and clear canvas
      if (broadcast) {
          broadcast('new_round', { roundId: newRoundId });
          broadcast('clear_canvas', {});
      }
  };

  const submitGuess = async () => {
      if (!roomId || !playerId || hasGuessed || isDrawer || currentPhase !== 'playing') return;
      if (!currentWord || !currentWord.word) {
          toast.error("Pas de mot à deviner");
          return;
      }
      
      const guess = userGuess.trim();
      if (!guess) return;
      
      // Filter numbers
      if (/\d/.test(guess)) {
          toast.error("Pas de chiffres !");
          return;
      }

      try {
          const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const userGuessNorm = normalize(guess);
          const correctWordNorm = normalize(currentWord.word);
          
          // Levenshtein
          const dist = levenshteinDistance(userGuessNorm, correctWordNorm);
          const threshold = correctWordNorm.length > 5 ? 2 : 1;
          const isCorrect = dist <= threshold;

          if (isCorrect) {
              const now = Date.now();
              const start = timerStartAt ? new Date(timerStartAt).getTime() : now;
              const timeTaken = Math.max(0, now - start);

              // Calculate Score (1000 -> 100)
              const maxTime = timerSeconds * 1000;
              let points = 100;
              if (timeTaken <= 5000) {
                  points = 1000;
              } else if (maxTime > 5000) {
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
              
              setUserGuess('');
          } else {
              // Check closeness for "Chauffe !" message
              if (dist <= threshold + 2) {
                  vibrate(HAPTIC.WARNING);
                  toast('Chauffe !', { icon: '🔥' });
              } else {
                  vibrate(HAPTIC.ERROR);
              }
              // Don't clear input on wrong answer - let them retry
          }
      } catch (err) {
          console.error('Error submitting guess:', err);
          toast.error("Erreur lors de la soumission");
      }
  };

  const returnToLobby = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('draw_games').delete().eq('room_id', roomId);
      await supabase.from('draw_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
      if (broadcast) await broadcast('return_to_lobby', {});
      router.push(`/room/${roomCode}?return=true`);
  };

  const cleanupForVote = async () => {
      if (!isHost || !roomId) return;
      await supabase.from('draw_games').delete().eq('room_id', roomId);
      await supabase.from('draw_players').delete().eq('room_id', roomId);
      await supabase.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
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
      }).sort((a, b) => (b.score - a.score) || a.name.localeCompare(b.name));
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
      voteToLobby={<VoteToLobby roomId={roomId || ''} playerId={playerId || ''} players={players} roomCode={roomCode} onAllVoted={cleanupForVote} />}
    >
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto h-full min-h-[calc(100vh-150px)] relative">
        
        {/* PHASE: SETUP */}
        {currentPhase === 'setup' && (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 animate-in fade-in w-full max-w-lg">
               <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal flex flex-col items-center w-full text-center">
                   <div className="bg-brand-inner border-4 border-brand-border p-6 rounded-2xl mb-6 shadow-brutal transform rotate-3">
                       <PenTool className="w-16 h-16 text-accent-secondary" />
                   </div>
                   
                   <div className="text-center space-y-2 mb-8">
                        <h2 className="font-display text-4xl font-black text-tx-base uppercase tracking-wider">Prêt à dessiner ?</h2>
                       <p className="text-tx-secondary font-bold">
                           Rounds : <span className="text-accent-secondary font-black uppercase tracking-widest">{totalRounds}</span> • 
                           Temps : <span className="text-[#06B6D4] font-black uppercase tracking-widest">{settings.time || 90}s</span>
                       </p>
                   </div>

                   {isHost ? (
                       <button 
                           onClick={startNewGame}
                           className="w-full h-16 rounded-2xl font-display text-xl font-black tracking-wider transition-colors border-4 border-brand-border bg-accent-secondary text-brand-bg hover:bg-brand-inner hover:text-accent-secondary shadow-brutal"
                       >
                           LANCER LA PARTIE
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

        {/* PHASE: PLAYING / RESULTS */}
        {(currentPhase === 'playing' || currentPhase === 'round_results') && (
            <div className="flex flex-col w-full h-full gap-4 p-4">
                
                {/* TOP: Word Reveal Card */}
                <div className="flex-shrink-0">
                    {isDrawer && currentPhase === 'playing' && (
                        <div className="bg-brand-card p-6 rounded-[32px] border-4 border-brand-border shadow-brutal word-reveal-container">
                            <div className="flex flex-col items-center gap-4">
                                <div className="word-display w-full">
                                    <div className="bg-brand-inner px-8 py-4 rounded-2xl border-4 border-brand-border w-full shadow-inner">
                                        <span className="block text-xs text-tx-secondary font-bold uppercase tracking-widest text-center mb-1">Mot à dessiner</span>
                                        <span className="font-display text-3xl font-black text-tx-base block text-center uppercase tracking-wider">{currentWord?.word}</span>
                                    </div>
                                </div>
                                <p className="word-hint text-tx-secondary font-bold uppercase tracking-widest text-sm text-center">Maintenir le bouton pour voir le mot</p>
                                <button
                                    type="button"
                                    className="w-full bg-brand-inner hover:bg-tx-base active:bg-tx-base border-4 border-brand-border rounded-2xl py-4 transition-colors select-none touch-none shadow-brutal active:translate-y-1 active:shadow-none group"
                                >
                                    <Eye className="w-8 h-8 mx-auto text-tx-base group-hover:text-brand-bg group-active:text-brand-bg transition-colors" />
                                </button>
                            </div>
                            <style jsx>{`
                                .word-reveal-container:has(button:active) .word-display {
                                    display: block !important;
                                }
                                .word-reveal-container:has(button:active) .word-hint {
                                    display: none !important;
                                }
                                .word-display {
                                    display: none;
                                }
                            `}</style>
                        </div>
                    )}
                    {!isDrawer && currentPhase === 'playing' && (
                        <div className="bg-brand-card px-8 py-4 rounded-2xl border-4 border-brand-border shadow-brutal flex items-center justify-center gap-4">
                            <PenTool className="w-6 h-6 text-accent-secondary animate-bounce" />
                            <span className="font-display font-black text-xl text-tx-base uppercase tracking-wider">{getDrawerName()} dessine</span>
                        </div>
                    )}
                    {currentPhase === 'round_results' && (
                        <div className="bg-brand-card px-10 py-6 rounded-[32px] border-4 border-brand-border shadow-brutal flex flex-col items-center justify-center">
                            <span className="block text-sm text-tx-secondary font-bold uppercase tracking-widest text-center mb-2">Le mot était</span>
                            <span className="font-display text-4xl font-black text-accent-secondary block text-center uppercase tracking-wider">{currentWord?.word}</span>
                        </div>
                    )}
                </div>

                {/* MIDDLE: Canvas */}
                <div className="flex-1 bg-white rounded-[32px] shadow-brutal overflow-hidden relative touch-none border-4 border-brand-border min-h-[300px]">
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
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-bg/95 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-4 shadow-brutal border-4 border-brand-border max-w-[95%] overflow-x-auto">
                            <div className="flex gap-2 flex-wrap justify-center min-w-[120px]">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "w-8 h-8 rounded-full border-4 transition-transform flex-shrink-0",
                                            color === c ? 'border-brand-border scale-110 shadow-brutal' : 'border-transparent hover:scale-110'
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <div className="w-1 h-8 bg-brand-inner rounded-full" />
                            <div className="flex gap-2 items-center">
                                {SIZES.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setSize(s)}
                                        className={cn(
                                            "rounded-full bg-brand-inner flex items-center justify-center transition-all border-2 border-brand-border",
                                            size === s ? 'ring-2 ring-brand-border shadow-sm' : 'hover:bg-brand-card'
                                        )}
                                        style={{ width: s + 16, height: s + 16, minWidth: s + 16, minHeight: s + 16 }}
                                    >
                                        <div className="rounded-full bg-brand-border" style={{ width: s, height: s }} />
                                    </button>
                                ))}
                            </div>
                            <div className="w-1 h-8 bg-brand-inner rounded-full" />
                            <button onClick={() => setColor('#FFFFFF')} className={cn(
                                "p-2.5 rounded-xl border-2 transition-colors",
                                color === '#FFFFFF' ? 'bg-brand-card border-brand-border shadow-sm' : 'bg-brand-inner border-transparent hover:border-brand-border'
                            )}>
                                <Eraser className="w-5 h-5 text-tx-base" />
                            </button>
                            <button onClick={clearCanvas} className="p-2.5 rounded-xl bg-brand-inner border-2 border-transparent hover:border-accent-secondary hover:bg-accent-secondary/10 transition-colors group">
                                <Trash2 className="w-5 h-5 text-accent-secondary group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    )}
                </div>

                {/* BOTTOM: Answer Input (Guesser Only) */}
                {!isDrawer && currentPhase === 'playing' && !hasGuessed && (
                    <div className="flex-shrink-0 pb-2">
                        <form onSubmit={(e) => { e.preventDefault(); submitGuess(); }} className="flex gap-3">
                            <input 
                                placeholder="Devinez le mot..." 
                                value={userGuess}
                                onChange={e => setUserGuess(e.target.value)}
                                className="flex-1 h-16 text-xl bg-brand-inner border-4 border-brand-border focus:border-tx-base text-tx-base placeholder:text-tx-muted text-center rounded-2xl shadow-brutal outline-none font-bold transition-colors"
                                autoFocus
                            />
                            <button 
                                type="submit" 
                                disabled={!userGuess.trim()}
                                className="h-16 w-20 bg-accent-success hover:bg-tx-base text-brand-bg font-black rounded-2xl shadow-brutal border-4 border-brand-border flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-6 h-6" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        )}

        {/* PHASE: PODIUM */}
        {currentPhase === 'podium' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full max-w-2xl p-4 animate-in zoom-in">
                <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 text-center w-full relative overflow-hidden shadow-brutal">
                    <div className="bg-brand-inner border-4 border-brand-border p-4 rounded-2xl inline-block shadow-brutal mb-6">
                        <Trophy className="w-16 h-16 text-accent-secondary" />
                    </div>
                    <h2 className="font-display text-4xl font-black text-tx-base mb-8 uppercase tracking-widest">Classement Final</h2>
                    
                    <div className="w-full space-y-4 mb-8">
                        {sortedPlayers.map((p, i) => (
                            <div key={p.id} className={cn(
                                "relative flex items-center justify-between p-4 rounded-2xl border-4 border-brand-border shadow-brutal",
                                i === 0 ? "bg-accent-secondary text-brand-bg transform scale-105 z-10" : "bg-brand-inner text-tx-base"
                            )}>
                                {/* Badges */}
                                {i === 0 && (
                                    <div className="absolute -top-4 -right-4 bg-[#FFD000] text-brand-bg border-4 border-brand-border text-xs font-black px-4 py-2 rounded-xl uppercase tracking-wider shadow-brutal transform rotate-12">
                                        Picasso
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
                                            {i === 0 ? '🎨 Artiste' : '✏️ Gribouilleur'}
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

      </div>
    </GameLayout>
  );
}
