import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface GameRoomState {
  room: any;
  session: any;
  players: any[];
  isConnected: boolean;
}

export function useGameRoom(roomId: string, playerId: string) {
  const [state, setState] = useState<GameRoomState>({
    room: null,
    session: null,
    players: [],
    isConnected: false
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Broadcast helper
  const broadcast = useCallback((event: string, payload: any) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event,
      payload
    }).catch(err => console.error('Broadcast error:', err));
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;
    
    // Initial fetch
    const fetchInitialState = async () => {
      const [roomRes, sessionRes, playersRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('game_sessions').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('players').select('*').eq('room_id', roomId)
      ]);

      if (isMounted) {
        setState(prev => ({
          ...prev,
          room: roomRes.data,
          session: sessionRes.data,
          players: playersRes.data || []
        }));
      }
    };

    fetchInitialState();

    // Setup Realtime Subscription
    const channel = supabase.channel(`room_sync:${roomId}`)
      // Listen to Room updates (status, settings)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (isMounted) {
            setState(prev => ({ ...prev, room: payload.new }));
          }
        }
      )
      // Listen to Session updates (game state, round data)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (isMounted && payload.new) {
            setState(prev => ({ ...prev, session: payload.new }));
          }
        }
      )
      // Listen to Player updates (score, join/leave)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        async () => {
          // Re-fetch all players to ensure consistency
          const { data } = await supabase.from('players').select('*').eq('room_id', roomId);
          if (isMounted && data) {
            setState(prev => ({ ...prev, players: data }));
          }
        }
      )
      // Broadcast events
      .on('broadcast', { event: 'player_answer' }, ({ payload }) => {
        // Handle optimistic UI updates or notifications here if needed
        console.log('Player answered:', payload);
      })
      .subscribe((status) => {
        if (isMounted) {
          setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
          if (status === 'SUBSCRIBED') {
             console.log(`Connected to room ${roomId}`);
          }
        }
      });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return {
    ...state,
    broadcast,
    refresh: () => { /* Force refresh logic if needed */ }
  };
}
