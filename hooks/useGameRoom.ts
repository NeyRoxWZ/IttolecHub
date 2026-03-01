import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface GameRoomState {
  room: any;
  session: any;
  players: any[];
  moves: any[];
  undercover: {
      game: any;
      roles: any[];
      clues: any[];
      votes: any[];
  };
  infiltre: {
      game: any;
      roles: any[];
      questions: any[];
      votes: any[];
  };
  isConnected: boolean;
}

export function useGameRoom(roomId: string, playerId: string) {
  const [state, setState] = useState<GameRoomState>({
    room: null,
    session: null,
    players: [],
    moves: [],
    undercover: {
        game: null,
        roles: [],
        clues: [],
        votes: []
    },
    infiltre: {
        game: null,
        roles: [],
        questions: [],
        votes: []
    },
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
      const [
          roomRes, sessionRes, playersRes, movesRes, 
          ucGame, ucRoles, ucClues, ucVotes,
          infGame, infRoles, infQuestions, infVotes
      ] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('game_sessions').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('players').select('*').eq('room_id', roomId),
        supabase.from('game_moves').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
        // Undercover Tables
        supabase.from('undercover_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('undercover_players').select('*').eq('room_id', roomId),
        supabase.from('undercover_clues').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
        supabase.from('undercover_votes').select('*').eq('room_id', roomId),
        // Infiltre Tables
        supabase.from('infiltre_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('infiltre_players').select('*').eq('room_id', roomId),
        supabase.from('infiltre_questions').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
        supabase.from('infiltre_votes').select('*').eq('room_id', roomId)
      ]);

      if (isMounted) {
        setState(prev => ({
          ...prev,
          room: roomRes.data,
          session: sessionRes.data,
          players: playersRes.data || [],
          moves: movesRes.data || [],
          undercover: {
              game: ucGame.data,
              roles: ucRoles.data || [],
              clues: ucClues.data || [],
              votes: ucVotes.data || []
          },
          infiltre: {
              game: infGame.data,
              roles: infRoles.data || [],
              questions: infQuestions.data || [],
              votes: infVotes.data || []
          }
        }));
      }
    };

    fetchInitialState();

    // Setup Realtime Subscription
    const channel = supabase.channel(`room_sync:${roomId}`)
      // Room
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
          if (isMounted) setState(prev => ({ ...prev, room: payload.new }));
      })
      // Session
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, session: payload.new }));
      })
      // Players
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, players: data }));
      })
      // Moves
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_moves', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, moves: [...prev.moves, payload.new] }));
      })
      
      // --- UNDERCOVER TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, undercover: { ...prev.undercover, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('undercover_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, undercover: { ...prev.undercover, roles: data } }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'undercover_clues', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, undercover: { ...prev.undercover, clues: [...prev.undercover.clues, payload.new] } }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'undercover_votes', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, undercover: { ...prev.undercover, votes: [...prev.undercover.votes, payload.new] } }));
      })

      // --- INFILTRE TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltre_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltre_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('infiltre_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, roles: data } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltre_questions', filter: `room_id=eq.${roomId}` }, async () => {
          // For questions (updates happen on answers), fetch all might be safer to keep order/updates correct
          // Or handle INSERT and UPDATE separately. Let's fetch all for robust sync for now.
          const { data } = await supabase.from('infiltre_questions').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
          if (isMounted && data) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, questions: data } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltre_votes', filter: `room_id=eq.${roomId}` }, async () => {
           const { data } = await supabase.from('infiltre_votes').select('*').eq('room_id', roomId);
           if (isMounted && data) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, votes: data } }));
      })

      .subscribe((status) => {
        if (isMounted) {
          setState(prev => ({ ...prev, isConnected: status === 'SUBSCRIBED' }));
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
