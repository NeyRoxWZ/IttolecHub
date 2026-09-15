import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useGameRoom } from './useGameRoom';
import { useServerTime } from './useServerTime';
import { toast } from 'sonner';
import { roomDb } from '@/lib/supabase/roomClient';
import { ABSENT_MS, recallSeat, rememberSeat, takeOverIfHostGone } from '@/lib/roomSeat';

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
  const [initialHost, setInitialHost] = useState(false);
  const { now } = useServerTime();

  // Use the new robust hook for sync
  const {
    room, session, players, moves,
    undercover, infiltre, flag, wiki, budget, draw, poke, rent, logo,
    isConnected, lastEvent, broadcast
  } = useGameRoom(roomId || '', playerId || '');

  // The host is whoever the room names right now: after a hand-over the new
  // host starts running the game loop without reloading anything.
  const isHost = room?.host_id ? room.host_id === playerId : initialHost;

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

      // 2. Who is this? This tab's seat, else the seat this device remembers for the room.
      const remembered = recallSeat(roomCode);
      const storedPlayerId = sessionStorage.getItem('playerId') || remembered?.playerId || null;
      const playerName = sessionStorage.getItem('playerName') || remembered?.name || null;

      // No name at all (link opened on a new device): the room page asks for one, then sends the player here.
      if (!storedPlayerId && !playerName) {
        window.location.href = `/room/${roomCode}`;
        return;
      }

      let player;

      // A. Try by ID
      if (storedPlayerId) {
        const { data } = await supabase.from('players').select('*').eq('id', storedPlayerId).eq('room_id', roomData.id).maybeSingle();
        if (data) player = data;
      }

      // B. Try by Name + Room: the same pseudo takes back the same seat.
      if (!player && playerName) {
        const { data } = await supabase.from('players').select('*').eq('room_id', roomData.id).eq('name', playerName).maybeSingle();
        if (data) player = data;
      }

      // A returning player takes their seat token back before writing anything.
      if (player) {
        const { error } = await roomDb.claim(roomData.id, { playerId: player.id });
        if (error) toast.error(error.message || 'Impossible de reprendre ta place.');
      }

      // C. Create new
      if (!player && playerName) {
        const { data: newPlayer } = await roomDb
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
          // If room has no host, claim it
          if (!roomData.host_id) {
            await roomDb.from('rooms').update({ host_id: newPlayer.id }).eq('id', roomData.id);
            await roomDb.from('players').update({ is_host: true }).eq('id', newPlayer.id);
            setInitialHost(true);
          }
        }
      }

      if (player) {
        setPlayerId(player.id);
        setInitialHost(player.is_host || roomData.host_id === player.id);
        sessionStorage.setItem('playerId', player.id);
        sessionStorage.setItem('playerName', player.name);
        rememberSeat(roomCode, { playerId: player.id, name: player.name });

        // Sync host status if mismatch
        if (player.is_host && roomData.host_id !== player.id) {
          await roomDb.from('rooms').update({ host_id: player.id }).eq('id', roomData.id);
        }

        // Initialize session if host and missing
        if (player.is_host) {
          const { data: existingSession } = await supabase.from('game_sessions').select('*').eq('room_id', roomData.id).maybeSingle();
          if (!existingSession) {
            await roomDb.from('game_sessions').insert({
              room_id: roomData.id,
              status: 'waiting'
            });
          }
        }
      }
    };

    init();
  }, [roomCode]);

  // Presence: every 30 s, and at once when the player comes back to the tab
  // (phones freeze timers in the background, which used to read as "gone").
  useEffect(() => {
    if (!playerId) return;
    const sendHeartbeat = async () => {
      await roomDb.from('players').update({ last_seen_at: new Date().toISOString() }).eq('id', playerId);
    };
    const onBack = () => { if (document.visibilityState === 'visible') void sendHeartbeat(); };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('online', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('online', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [playerId]);

  // Nobody is removed for being away during a game any more: they keep their
  // seat and find it again when they come back. Only the host excludes someone.

  // The host went quiet: the first active player takes over instead of the
  // whole room closing on everyone.
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => {
    if (!roomId || !playerId) return;
    const check = async () => {
      if (await takeOverIfHostGone(roomId, playerId, room?.host_id, playersRef.current)) {
        toast.success('L’hôte est parti : tu mènes la partie maintenant.');
      }
    };
    const interval = setInterval(check, 20000);
    return () => clearInterval(interval);
  }, [roomId, playerId, room?.host_id]);

  // Excluded by the host: this seat disappeared after being seen.
  const seenSelf = useRef(false);
  useEffect(() => {
    if (!playerId || players.length === 0) return;
    if (players.some((p: any) => p.id === playerId)) { seenSelf.current = true; return; }
    if (seenSelf.current) {
      toast.error('Tu as été exclu de la partie.');
      window.location.href = '/';
    }
  }, [players, playerId]);

  // Actions
  const updateSettings = async (newSettings: any) => {
    if (!roomId || !isHost) return;
    const { error } = await roomDb.from('rooms').update({ settings: newSettings }).eq('id', roomId);
    if (error) {
      console.error('Error updating settings:', error);
      toast.error("Impossible de sauvegarder les réglages. Vérifiez votre connexion.");
    }
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
    const { error: sessionError } = await roomDb
        .from('game_sessions')
        .upsert(sessionPayload, { onConflict: 'room_id' });

    if (sessionError) {
      console.error('ERREUR SUPABASE (startGame session):', sessionError);
      toast.error("Impossible de lancer la partie. Réessayez.");
      return;
    }

    const roomPayload = { status: 'in_game' };
    const { error: roomError } = await roomDb.from('rooms').update(roomPayload).eq('id', roomId);
    if (roomError) {
      console.error('ERREUR SUPABASE (startGame room):', roomError);
      toast.error("Impossible de lancer la partie. Réessayez.");
    }
  };

  const submitAnswer = async (answer: any) => {
    if (!roomId || !playerId || !gameState) return;
    const newAnswers = { ...gameState.answers, [playerId]: { answer, time: Date.now() } };
    const { error } = await roomDb.from('game_sessions').update({ answers: newAnswers }).eq('room_id', roomId);
    if (error) toast.error("Votre réponse n'a pas été envoyée. Réessayez.");
  };

  const setPlayerReady = async (isReady: boolean) => {
    if (!playerId) return;
    const { error } = await roomDb.from('players').update({ is_ready: isReady }).eq('id', playerId);
    if (error) toast.error("Impossible de mettre à jour votre statut. Réessayez.");
  };

  const resetAllPlayersReady = async () => {
    if (!roomId || !isHost) return;
    await roomDb.from('players').update({ is_ready: false }).eq('room_id', roomId);
  };

  const sendMove = async (actionType: string, payload: any) => {
    if (!roomId || !playerId) return;
    const { error } = await roomDb.from('game_moves').insert({
        room_id: roomId,
        player_id: playerId,
        action_type: actionType,
        // game_type removed as it's not in the schema
        payload
    });
    if (error) toast.error("Action non envoyée. Vérifiez votre connexion.");
  };

  const nextRound = async (nextRoundData: any = {}) => {
    if (!roomId || !isHost || !gameState) return;
    const nextRound = gameState.current_round + 1;
    if (nextRound > gameState.total_rounds) {
        await roomDb.from('rooms').update({ status: 'finished' }).eq('id', roomId);
        await roomDb.from('game_sessions').update({ status: 'game_over' }).eq('room_id', roomId);
    } else {
        await roomDb.from('game_sessions').update({
            current_round: nextRound,
            answers: {},
            status: 'round_active',
            round_data: nextRoundData
        }).eq('room_id', roomId);
    }
  };

  const updateRoundData = async (data: any) => {
    if (!roomId || !isHost) return;
    await roomDb.from('game_sessions').update({ round_data: data }).eq('room_id', roomId);
  };

  const setGameStatus = async (status: GameState['status']) => {
    if (!roomId || !isHost) return;
    await roomDb.from('game_sessions').update({ status }).eq('room_id', roomId);
  };

  const updatePlayerScore = async (playerId: string, score: number) => {
    if (!roomId || !isHost) return;
    await roomDb.from('players').update({ score }).eq('id', playerId);
  };

  // Helper to get synced time left
  const getTimeLeft = useCallback((endTime?: number | null) => {
    if (!endTime) return 0;
    const current = now(); // Synced server time
    const diff = Math.ceil((endTime - current) / 1000);
    return diff > 0 ? diff : 0;
  }, [now]);

  /** Players who stopped sending presence: shown as away, their turns can be skipped. */
  const isPlayerAway = useCallback((id: string) => {
    const p = players.find((x: any) => x.id === id);
    return !p?.last_seen_at || Date.now() - new Date(p.last_seen_at).getTime() > ABSENT_MS;
  }, [players]);

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
    updatePlayerScore,
    setPlayerReady, // Exposed
    resetAllPlayersReady, // Exposed
    sendMove, // Exposed robust move function
    moves, // Exposed moves history
    undercover, // Exposed dedicated tables
    infiltre, // Exposed dedicated tables
    flag, // Exposed dedicated tables
    wiki, // Exposed dedicated tables
    budget, // Exposed dedicated tables
    draw, // Exposed dedicated tables
    poke, // Exposed dedicated tables
    rent, // Exposed dedicated tables
    logo, // Exposed dedicated tables
    getTimeLeft, // Exposed for components
    serverTime: now, // Exposed if needed
    roomId, // Exposed UUID
    lastEvent, // Exposed for components
    broadcast, // Exposed for components
    isConnected, // Exposed for connection-status banner
    isPlayerAway, // Exposed: away players (turn skipping, host tools)
  };
}
