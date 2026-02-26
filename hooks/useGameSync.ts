import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useGameRoom } from './useGameRoom';

export interface Player {
  id: string;
  name: string;
  is_host: boolean;
  score: number;
  joined_at: string;
  avatar?: string;
  last_seen_at?: string;
}

export interface GameState {
  current_round: number;
  total_rounds: number;
  round_data: any;
  answers: Record<string, any>;
  status: 'waiting' | 'in_game' | 'round_active' | 'round_results' | 'game_over';
  settings: any;
}

export function useGameSync(roomCode: string, gameType: string) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  
  // Use the new robust hook for sync
  const { room, session, players, isConnected } = useGameRoom(roomId || '', playerId || '');

  // Derived state
  const roomStatus = room?.status || 'waiting';
  
  const gameState: GameState | null = useMemo(() => {
    if (!session) return null;
    return {
      current_round: session.current_round,
      total_rounds: session.total_rounds,
      round_data: session.round_data,
      answers: session.answers,
      status: session.status,
      settings: room?.settings || {},
    };
  }, [session, room]);

  // Initialization: Resolve Room Code & Register Player
  useEffect(() => {
    if (!roomCode) return;

    const init = async () => {
      // 1. Get room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle();

      if (roomError || !roomData) {
        console.error('Room not found:', roomError);
        return;
      }

      setRoomId(roomData.id);

      // 2. Register/Identify player
      const storedPlayerId = sessionStorage.getItem('playerId');
      const playerName = sessionStorage.getItem('playerName') || `Player-${Math.floor(Math.random() * 1000)}`;
      
      let player;

      // A. Try by ID
      if (storedPlayerId) {
        const { data } = await supabase.from('players').select('*').eq('id', storedPlayerId).maybeSingle();
        if (data) player = data;
      }

      // B. Try by Name + Room
      if (!player) {
        const { data } = await supabase.from('players').select('*').eq('room_id', roomData.id).eq('name', playerName).maybeSingle();
        if (data) player = data;
      }

      // C. Create new
      if (!player) {
        const { data: newPlayer } = await supabase
          .from('players')
          .insert({
            room_id: roomData.id,
            name: playerName,
            is_host: roomData.host_id ? false : true,
          })
          .select()
          .maybeSingle();
        
        if (newPlayer) {
          player = newPlayer;
          sessionStorage.setItem('playerId', newPlayer.id);
          // If room has no host, claim it
          if (!roomData.host_id) {
             await supabase.from('rooms').update({ host_id: newPlayer.id }).eq('id', roomData.id);
             await supabase.from('players').update({ is_host: true }).eq('id', newPlayer.id);
             setIsHost(true);
          }
        }
      }

      if (player) {
        setPlayerId(player.id);
        setIsHost(player.is_host);
        
        // Sync host status if mismatch
        if (player.is_host && roomData.host_id !== player.id) {
            await supabase.from('rooms').update({ host_id: player.id }).eq('id', roomData.id);
        }

        // Initialize session if host and missing
        if (player.is_host) {
             const { data: existingSession } = await supabase.from('game_sessions').select('*').eq('room_id', roomData.id).maybeSingle();
             if (!existingSession) {
                 await supabase.from('game_sessions').insert({
                    room_id: roomData.id,
                    status: 'waiting'
                 });
             }
        }
      }
    };

    init();
  }, [roomCode]);

  // Heartbeat system
  useEffect(() => {
    if (!playerId) return;
    const sendHeartbeat = async () => {
        await supabase.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId);
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [playerId]);

  // Cleanup inactive players (Host only)
  useEffect(() => {
    if (!isHost || !roomId) return;
    const cleanup = async () => {
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        await supabase.from('players').delete().eq('room_id', roomId).lt('last_seen_at', twoMinAgo);
    };
    const interval = setInterval(cleanup, 60000);
    return () => clearInterval(interval);
  }, [isHost, roomId]);

  // Check Host Inactivity
  useEffect(() => {
    if (!roomId || !players.length) return;
    const checkHost = async () => {
       const host = players.find((p: any) => p.is_host);
       if (host && host.last_seen_at) {
          const lastSeen = new Date(host.last_seen_at).getTime();
          if (Date.now() - lastSeen > 150000) {
             if (roomStatus !== 'closed') {
                 await supabase.from('rooms').update({ status: 'closed' }).eq('id', roomId);
             }
          }
       }
    };
    const interval = setInterval(checkHost, 30000);
    return () => clearInterval(interval);
  }, [roomId, players, roomStatus]);


  // Actions
  const updateSettings = async (newSettings: any) => {
    if (!roomId || !isHost) return;
    const { error } = await supabase.from('rooms').update({ settings: newSettings }).eq('id', roomId);
    if (error) console.error('Error updating settings:', error);
  };

  const startGame = async (initialRoundData: any = {}) => {
    if (!roomId || !isHost) return;
    
    const sessionPayload = {
        room_id: roomId,
        status: 'round_active',
        current_round: 1,
        answers: {},
        round_data: initialRoundData
    };
    
    // Use upsert to ensure session exists and handle race conditions
    const { error: sessionError } = await supabase
        .from('game_sessions')
        .upsert(sessionPayload, { onConflict: 'room_id' });
        
    if (sessionError) console.error('ERREUR SUPABASE (startGame session):', sessionError);

    const roomPayload = { status: 'in_game' };
    const { error: roomError } = await supabase.from('rooms').update(roomPayload).eq('id', roomId);
    if (roomError) console.error('ERREUR SUPABASE (startGame room):', roomError);
  };

  const submitAnswer = async (answer: any) => {
    if (!roomId || !playerId || !gameState) return;
    const newAnswers = { ...gameState.answers, [playerId]: { answer, time: Date.now() } };
    await supabase.from('game_sessions').update({ answers: newAnswers }).eq('room_id', roomId);
  };

  const nextRound = async (nextRoundData: any = {}) => {
    if (!roomId || !isHost || !gameState) return;
    const nextRound = gameState.current_round + 1;
    if (nextRound > gameState.total_rounds) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId);
        await supabase.from('game_sessions').update({ status: 'game_over' }).eq('room_id', roomId);
    } else {
        await supabase.from('game_sessions').update({
            current_round: nextRound,
            answers: {},
            status: 'round_active',
            round_data: nextRoundData
        }).eq('room_id', roomId);
    }
  };

  const updateRoundData = async (data: any) => {
    if (!roomId || !isHost) return;
    await supabase.from('game_sessions').update({ round_data: data }).eq('room_id', roomId);
  };

  const setGameStatus = async (status: GameState['status']) => {
    if (!roomId || !isHost) return;
    await supabase.from('game_sessions').update({ status }).eq('room_id', roomId);
  };

  const updatePlayerScore = async (playerId: string, score: number) => {
    if (!roomId || !isHost) return;
    await supabase.from('players').update({ score }).eq('id', playerId);
  };

  return {
    roomStatus,
    players,
    gameState,
    isHost,
    playerId,
    updateSettings,
    startGame,
    submitAnswer,
    nextRound,
    updateRoundData,
    setGameStatus,
    updatePlayerScore
  };
}
