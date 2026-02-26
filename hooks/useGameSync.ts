import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  const [roomStatus, setRoomStatus] = useState<'waiting' | 'in_game' | 'finished' | 'closed'>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initialize player and room
  useEffect(() => {
    if (!roomCode) return;

    const init = async () => {
      // 1. Get room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle();

      if (roomError || !room) {
        console.error('Room not found:', roomError);
        return;
      }

      setRoomId(room.id);
      setRoomStatus(room.status);
      
      // 2. Register player
      const playerName = sessionStorage.getItem('playerName') || `Player-${Math.floor(Math.random() * 1000)}`;
      let currentPayloadId = sessionStorage.getItem('playerId');

      // Check if player exists
      let player;
      
      // A. Try by ID first
      if (currentPayloadId) {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('id', currentPayloadId)
          .maybeSingle();
        if (data) player = data;
      }

      // B. Try by Name + Room (recovery if ID lost or not set)
      if (!player) {
         const { data } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', room.id)
          .eq('name', playerName)
          .maybeSingle();
         if (data) player = data;
      }

      if (!player) {
        // Create new player
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({
            room_id: room.id,
            name: playerName,
            is_host: room.host_id ? false : true, // First player is host if host_id is null (logic might vary)
            // But usually host creates room. Here we assume joining.
            // If room has no host_id, claim it?
          })
          .select()
          .single();
        
        if (newPlayer) {
          player = newPlayer;
          sessionStorage.setItem('playerId', newPlayer.id);
          // If we just created the player and room has no host, set this player as host
          if (!room.host_id) {
             await supabase.from('rooms').update({ host_id: newPlayer.id }).eq('id', room.id);
             await supabase.from('players').update({ is_host: true }).eq('id', newPlayer.id);
             setIsHost(true);
          }
        }
      }

      if (player) {
        setPlayerId(player.id);
        setIsHost(player.is_host); // Sync host status
        
        // Update host if needed (e.g. if we are marked as host in players table)
        if (player.is_host && room.host_id !== player.id) {
            await supabase.from('rooms').update({ host_id: player.id }).eq('id', room.id);
        }
      }

      // 3. Fetch initial game state
      const { data: session } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('room_id', room.id)
        .maybeSingle();

      if (session) {
        setGameState({
          current_round: session.current_round,
          total_rounds: session.total_rounds,
          round_data: session.round_data,
          answers: session.answers,
          status: session.status,
          settings: room.settings,
        });
      } else {
        // Create initial session if missing
        if (player?.is_host) {
             const { data: newSession } = await supabase
            .from('game_sessions')
            .insert({
                room_id: room.id,
                status: 'waiting',
                settings: room.settings
            })
            .select()
            .single();
            if (newSession) {
                setGameState(newSession as any);
            }
        }
      }

      // 4. Fetch all players
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', room.id);
      
      if (allPlayers) setPlayers(allPlayers);
    };

    init();
  }, [roomCode]);

  // Subscribe to changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`game_sync:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            setRoomStatus((payload.new as any).status);
            if (gameState) {
                setGameState(prev => prev ? ({ ...prev, settings: (payload.new as any).settings }) : null);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId);
          if (data) setPlayers(data);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            setGameState(prev => ({ ...prev, ...(payload.new as any) }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Heartbeat system (Presence)
  useEffect(() => {
    if (!playerId) return;
    
    const sendHeartbeat = async () => {
        await supabase.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId);
    };
    
    // Initial heartbeat
    sendHeartbeat();
    
    const interval = setInterval(sendHeartbeat, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [playerId]);

  // Cleanup inactive players (Host only)
  useEffect(() => {
    if (!isHost || !roomId) return;
    
    const cleanup = async () => {
        // Remove players inactive for > 2 minutes
        // We use raw SQL query logic or Supabase filters
        // Since we can't do complex date math in filter easily without stored procedure, 
        // we calculate the ISO string for 2 minutes ago.
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        await supabase
            .from('players')
            .delete()
            .eq('room_id', roomId)
            .lt('last_seen_at', twoMinAgo);
    };
    
    const interval = setInterval(cleanup, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [isHost, roomId]);

  // Check Host Inactivity (run by everyone to detect if host is gone)
  useEffect(() => {
    if (!roomId || !players.length) return;

    const checkHost = async () => {
       // Find host in players list
       const host = players.find(p => p.is_host);
       if (host && host.last_seen_at) {
          const lastSeen = new Date(host.last_seen_at).getTime();
          // If host inactive for > 2m30s (buffer), close room
          if (Date.now() - lastSeen > 150000) {
             console.log("Host inactive, closing room...");
             // Only one client needs to succeed, but multiple might try. RLS allows.
             // Ideally only the "next" oldest player does this, but keeping it simple.
             // We check if room is already closed to avoid spam
             if (roomStatus !== 'closed') {
                 await supabase.from('rooms').update({ status: 'closed' }).eq('id', roomId);
             }
          }
       }
    };

    const interval = setInterval(checkHost, 30000); 
    return () => clearInterval(interval);
  }, [roomId, players, roomStatus]);

  // Handle browser close / visibility
  useEffect(() => {
      if (!playerId) return;
      
      const handleUnload = () => {
          // Attempt to remove player immediately
          // We use navigator.sendBeacon for reliability during unload, 
          // but Supabase client might not support it directly.
          // Fallback to fetch with keepalive if possible, or just synchronous supabase call (best effort)
          // Since we have heartbeat, this is just optimization.
          
          // We can't await here reliably.
          // Let's rely on heartbeat timeout for robust cleanup.
          // But we can try to set status to 'inactive' if we had such column.
      };
      
      // window.addEventListener('beforeunload', handleUnload);
      // return () => window.removeEventListener('beforeunload', handleUnload);
  }, [playerId]);

  // Actions
  const updateSettings = async (newSettings: any) => {
    if (!roomId || !isHost) return;
    const { error } = await supabase.from('rooms').update({ settings: newSettings }).eq('id', roomId);
    if (error) console.error('Error updating settings (useGameSync):', error, newSettings);
  };

  const startGame = async (initialRoundData: any = {}) => {
    if (!roomId || !isHost) return;
    
    // Update room status
    await supabase.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
    
    // Initialize game session
    await supabase.from('game_sessions').update({
        status: 'round_active',
        current_round: 1,
        answers: {},
        round_data: initialRoundData
    }).eq('room_id', roomId);
  };

  const submitAnswer = async (answer: any) => {
    if (!roomId || !playerId || !gameState) return;
    
    const newAnswers = { ...gameState.answers, [playerId]: { answer, time: Date.now() } };
    
    await supabase.from('game_sessions').update({
        answers: newAnswers
    }).eq('room_id', roomId);
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
