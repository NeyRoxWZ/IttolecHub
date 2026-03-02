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
  flag: {
      game: any;
      players: any[];
  };
  wiki: {
      game: any;
      players: any[];
  };
  budget: {
      game: any;
      players: any[];
  };
  draw: {
      game: any;
      players: any[];
  };
  poke: {
      game: any;
      players: any[];
  };
  rent: {
      game: any;
      players: any[];
  };
  airbnb: {
      game: any;
      players: any[];
  };
  logo: {
      game: any;
      players: any[];
  };
  isConnected: boolean;
  lastEvent: { type: string; payload: any; timestamp: number } | null;
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
    flag: {
        game: null,
        players: []
    },
    wiki: {
        game: null,
        players: []
    },
    budget: {
        game: null,
        players: []
    },
    draw: {
        game: null,
        players: []
    },
    poke: {
        game: null,
        players: []
    },
    rent: {
        game: null,
        players: []
    },
    airbnb: {
        game: null,
        players: []
    },
    logo: {
        game: null,
        players: []
    },
    isConnected: false,
    lastEvent: null
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Broadcast helper
  const broadcast = useCallback(async (event: string, payload: any) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: event,
      payload: payload
    });
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let isMounted = true;
    
    // Initial fetch
    const fetchInitialState = async () => {
      const [
          roomRes, sessionRes, playersRes, movesRes, 
          ucGame, ucRoles, ucClues, ucVotes,
          infGame, infRoles, infQuestions, infVotes,
          flagGame, flagPlayers,
          wikiGame, wikiPlayers,
          budgetGame, budgetPlayers,
          drawGame, drawPlayers,
          pokeGame, pokePlayers,
          rentGame, rentPlayers,
          airbnbGame, airbnbPlayers,
          logoGame, logoPlayers
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
        supabase.from('infiltre_votes').select('*').eq('room_id', roomId),
        // Flag Tables
        supabase.from('flag_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('flag_players').select('*').eq('room_id', roomId),
        // Wiki Tables
        supabase.from('wiki_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('wiki_players').select('*').eq('room_id', roomId),
        // Budget Tables
        supabase.from('budget_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('budget_players').select('*').eq('room_id', roomId),
        // Draw Tables
        supabase.from('draw_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('draw_players').select('*').eq('room_id', roomId),
        // Poke Tables
        supabase.from('poke_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('poke_players').select('*').eq('room_id', roomId),
        // Rent Tables
        supabase.from('rent_games').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('rent_players').select('*').eq('room_id', roomId),
        // Airbnb Tables
         supabase.from('airbnb_games').select('*').eq('room_id', roomId).maybeSingle(),
         supabase.from('airbnb_players').select('*').eq('room_id', roomId),
         // Logo Tables
         supabase.from('logo_games').select('*').eq('room_id', roomId).maybeSingle(),
         supabase.from('logo_players').select('*').eq('room_id', roomId)
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
          },
          flag: {
              game: flagGame.data,
              players: flagPlayers.data || []
          },
          wiki: {
              game: wikiGame.data,
              players: wikiPlayers.data || []
          },
          budget: {
              game: budgetGame.data,
              players: budgetPlayers.data || []
          },
          draw: {
              game: drawGame.data,
              players: drawPlayers.data || []
          },
          poke: {
              game: pokeGame.data,
              players: pokePlayers.data || []
          },
          rent: {
              game: rentGame.data,
              players: rentPlayers.data || []
          },
          airbnb: {
              game: airbnbGame.data,
              players: airbnbPlayers.data || []
          },
          logo: {
              game: logoGame.data,
              players: logoPlayers.data || []
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_clues', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('undercover_clues').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
          if (isMounted && data) setState(prev => ({ ...prev, undercover: { ...prev.undercover, clues: data } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'undercover_votes', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('undercover_votes').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, undercover: { ...prev.undercover, votes: data } }));
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
          const { data } = await supabase.from('infiltre_questions').select('*').eq('room_id', roomId).order('created_at', { ascending: true });
          if (isMounted && data) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, questions: data } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'infiltre_votes', filter: `room_id=eq.${roomId}` }, async () => {
           const { data } = await supabase.from('infiltre_votes').select('*').eq('room_id', roomId);
           if (isMounted && data) setState(prev => ({ ...prev, infiltre: { ...prev.infiltre, votes: data } }));
      })

      // --- FLAG TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flag_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, flag: { ...prev.flag, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flag_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('flag_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, flag: { ...prev.flag, players: data } }));
      })

      // --- WIKI TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wiki_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, wiki: { ...prev.wiki, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wiki_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('wiki_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, wiki: { ...prev.wiki, players: data } }));
      })

      // --- BUDGET TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, budget: { ...prev.budget, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('budget_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, budget: { ...prev.budget, players: data } }));
      })

      // --- DRAW TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draw_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, draw: { ...prev.draw, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draw_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('draw_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, draw: { ...prev.draw, players: data } }));
      })

      // --- POKE TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poke_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, poke: { ...prev.poke, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poke_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('poke_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, poke: { ...prev.poke, players: data } }));
      })

      // --- RENT TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rent_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, rent: { ...prev.rent, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rent_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('rent_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, rent: { ...prev.rent, players: data } }));
      })

      // --- AIRBNB TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'airbnb_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, airbnb: { ...prev.airbnb, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'airbnb_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('airbnb_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, airbnb: { ...prev.airbnb, players: data } }));
      })

      // --- LOGO TABLES ---
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logo_games', filter: `room_id=eq.${roomId}` }, (payload) => {
          if (isMounted && payload.new) setState(prev => ({ ...prev, logo: { ...prev.logo, game: payload.new } }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logo_players', filter: `room_id=eq.${roomId}` }, async () => {
          const { data } = await supabase.from('logo_players').select('*').eq('room_id', roomId);
          if (isMounted && data) setState(prev => ({ ...prev, logo: { ...prev.logo, players: data } }));
      })

      // --- BROADCAST EVENTS ---
      .on('broadcast', { event: '*' }, (payload) => {
          if (isMounted) setState(prev => ({ 
              ...prev, 
              lastEvent: { type: payload.event, payload: payload.payload, timestamp: Date.now() } 
          }));
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
