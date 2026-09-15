import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Live state of a multiplayer room: the room, its game session, the players,
 * the moves they made, and short-lived broadcast events (a stroke being drawn).
 * Every game runs on these four tables (see games/party/usePartyGame).
 */
export interface GameRoomState {
  room: any;
  session: any;
  players: any[];
  moves: any[];
  isConnected: boolean;
  lastEvent: { type: string; payload: any; timestamp: number } | null;
}

export function useGameRoom(roomId: string, _playerId: string) {
  const [state, setState] = useState<GameRoomState>({
    room: null,
    session: null,
    players: [],
    moves: [],
    isConnected: false,
    lastEvent: null,
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const broadcast = useCallback(async (event: string, payload: any) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: 'broadcast', event, payload });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;

    const fetchAll = async () => {
      const [roomRes, sessionRes, playersRes, movesRes] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('game_sessions').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('players').select('*').eq('room_id', roomId),
        supabase.from('game_moves').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      ]);
      if (!isMounted) return;
      setState((prev) => ({
        ...prev,
        room: roomRes.data ?? prev.room,
        session: sessionRes.error ? prev.session : sessionRes.data,
        players: playersRes.data || prev.players,
        moves: movesRes.data || prev.moves,
      }));
    };

    fetchAll();

    // Realtime drops events while a phone sleeps or a tab sits in the background:
    // catch up when the player comes back, and every few seconds.
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(fetchAll, 8000);

    const channel = supabase.channel(`room_sync:${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        if (isMounted) setState((prev) => ({ ...prev, room: payload.new }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (isMounted && payload.new) setState((prev) => ({ ...prev, session: payload.new }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, async () => {
        const { data } = await supabase.from('players').select('*').eq('room_id', roomId);
        if (isMounted && data) setState((prev) => ({ ...prev, players: data }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_moves', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (isMounted && payload.new) setState((prev) => (prev.moves.some((m) => m.id === (payload.new as any).id) ? prev : { ...prev, moves: [...prev.moves, payload.new] }));
      })
      .on('broadcast', { event: '*' }, (payload) => {
        if (isMounted) setState((prev) => ({ ...prev, lastEvent: { type: payload.event, payload: payload.payload, timestamp: Date.now() } }));
      })
      .subscribe((status) => {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
        if (status === 'SUBSCRIBED') void fetchAll();
      });

    channelRef.current = channel;

    return () => {
      isMounted = false;
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { ...state, broadcast };
}
