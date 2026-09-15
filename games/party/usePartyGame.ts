'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useGameSync } from '@/hooks/useGameSync';
import { roomDb } from '@/lib/supabase/roomClient';

/**
 * The engine shared by the party games (Hors Sujet, Punchline, Petit Bac…).
 *
 * - The round lives in game_sessions.round_data, written by the host only:
 *   { gid, phase, ends_at, scores, …whatever the game needs }.
 * - Players act through game_moves. Every move is stamped with the game id,
 *   the round and the phase it was made in, so moves from an earlier round or
 *   an earlier game (still in the local list: deletions are not pushed live)
 *   are ignored.
 * - The host's screen drives the game: it watches the moves and the clock and
 *   writes the next state. If the host leaves, the next host picks it up from
 *   the same data.
 */

export interface PartyPlayer {
  id: string;
  name: string;
  joined_at?: string;
  last_seen_at?: string;
}

export interface PartyMove {
  id: string;
  player_id: string;
  action_type: string;
  payload: any;
  created_at: string;
}

export type Scores = Record<string, number>;

export function usePartyGame(roomCode: string, gameType: string) {
  const router = useRouter();
  const sync = useGameSync(roomCode, gameType);
  const { gameState, players, playerId, isHost, roomId, moves, serverTime, isPlayerAway, sendMove, isConnected } = sync;

  const round = (gameState?.round_data || {}) as Record<string, any>;
  const phase: string = round.phase || 'setup';
  const settings = (gameState?.settings || {}) as Record<string, any>;
  const gid: string | undefined = round.gid;
  const roundNo = gameState?.current_round || 1;
  const totalRounds = gameState?.total_rounds || Number(settings.rounds) || 5;
  const scores: Scores = round.scores || {};

  // The clock ticks while a phase has a deadline.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!round.ends_at) return;
    const t = setInterval(() => setTick((x) => x + 1), 250);
    return () => clearInterval(t);
  }, [round.ends_at]);
  const nowMs = serverTime();
  const timeLeft = round.ends_at ? Math.max(0, Math.ceil((round.ends_at - nowMs) / 1000)) : 0;
  const expired = !!round.ends_at && nowMs >= round.ends_at;

  const seated = useMemo(
    () => [...(players as PartyPlayer[])].sort((a, b) => String(a.joined_at || '').localeCompare(String(b.joined_at || ''))),
    [players],
  );
  /** Players still here: the ones a phase waits for. */
  const active = useMemo(() => seated.filter((p) => !isPlayerAway(p.id) || p.id === playerId), [seated, isPlayerAway, playerId]);
  const nameOf = useCallback((id?: string | null) => seated.find((p) => p.id === id)?.name || 'Joueur parti', [seated]);

  /** This round's moves made during `inPhase` (the current phase by default). */
  const movesIn = useCallback(
    (inPhase: string = phase, type?: string): PartyMove[] =>
      (moves as PartyMove[]).filter(
        (m) => m.payload?.g === gid && m.payload?.r === roundNo && m.payload?.p === inPhase && (!type || m.action_type === type),
      ),
    [moves, gid, roundNo, phase],
  );

  /** Each player's latest move of a kind in a phase. */
  const latestBy = useCallback(
    (type: string, inPhase: string = phase): Record<string, any> => {
      const out: Record<string, any> = {};
      for (const m of movesIn(inPhase, type)) out[m.player_id] = m.payload;
      return out;
    },
    [movesIn, phase],
  );

  const act = useCallback(
    (type: string, data: Record<string, unknown> = {}) => sendMove(type, { ...data, g: gid, r: roundNo, p: phase }),
    [sendMove, gid, roundNo, phase],
  );

  /* ---------------- host writes ---------------- */

  const writeSession = useCallback(
    async (values: Record<string, unknown>) => {
      if (!roomId) return;
      const { error } = await roomDb.from('game_sessions').update(values).eq('room_id', roomId);
      if (error) toast.error('La partie n’a pas pu avancer. Vérifie ta connexion.');
    },
    [roomId],
  );

  /** Replaces the round state (gid and scores carried over unless given). */
  const setRound = useCallback(
    (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      writeSession({ round_data: { gid, scores, ...data }, ...extra }),
    [writeSession, gid, scores],
  );

  const patchRound = useCallback((patch: Record<string, unknown>) => writeSession({ round_data: { ...round, ...patch } }), [writeSession, round]);

  /** A deadline `seconds` from now, on the shared clock. */
  const deadline = useCallback((seconds: number) => serverTime() + Math.max(1, seconds) * 1000, [serverTime]);

  /** Starts (or restarts) a game: fresh id, round 1, no scores. `answers` holds the deck for the whole game. */
  const startGame = useCallback(
    async (deck: unknown, first: Record<string, unknown>, rounds = totalRounds) => {
      if (!roomId) return;
      const newGid = Math.random().toString(36).slice(2, 10);
      await roomDb.from('game_moves').delete().eq('room_id', roomId);
      const { error } = await roomDb.from('game_sessions').upsert(
        { room_id: roomId, status: 'round_active', current_round: 1, total_rounds: rounds, answers: { deck }, round_data: { ...first, gid: newGid, scores: {} } },
        { onConflict: 'room_id' },
      );
      if (error) {
        toast.error('Impossible de lancer la partie. Réessaie.');
        return;
      }
      await roomDb.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
    },
    [roomId, totalRounds],
  );

  const goToRound = useCallback(
    (n: number, data: Record<string, unknown>) => setRound(data, { current_round: n }),
    [setRound],
  );

  const endGame = useCallback((finalScores: Scores = scores) => setRound({ phase: 'podium', scores: finalScores }, { status: 'game_over' }), [setRound, scores]);

  const backToLobby = useCallback(async () => {
    if (!roomId) return;
    await roomDb.from('rooms').update({ status: 'waiting' }).eq('id', roomId);
    await roomDb.from('game_sessions').delete().eq('room_id', roomId);
    router.push(`/room/${roomCode}?return=true`);
  }, [roomId, roomCode, router]);

  // The host sent everyone back to the room: follow, instead of waiting on a game that no longer exists.
  const seenPlaying = useRef(false);
  useEffect(() => {
    if (sync.roomStatus === 'in_game') seenPlaying.current = true;
    else if (sync.roomStatus === 'waiting' && seenPlaying.current && roomId) router.push(`/room/${roomCode}?return=true`);
  }, [sync.roomStatus, roomId, roomCode, router]);

  const deck = (gameState?.answers as any)?.deck;

  return {
    ...sync,
    roomCode,
    loaded: !!gameState,
    round,
    phase,
    settings,
    gid,
    roundNo,
    totalRounds,
    scores,
    deck,
    timeLeft,
    expired,
    seated,
    active,
    nameOf,
    movesIn,
    latestBy,
    act,
    setRound,
    patchRound,
    deadline,
    startGame,
    goToRound,
    endGame,
    backToLobby,
    isHost,
    playerId,
    isConnected,
  };
}

export type Party = ReturnType<typeof usePartyGame>;

/**
 * Runs `action` once per `key` on the host's screen, as soon as `when` holds.
 * Keys name a transition (« 3:answer-end »): a re-render before the new state
 * arrives cannot fire the same transition twice. The returned function runs it
 * by hand (a « Continue » button) under the same once-only rule.
 */
export function useHostStep(party: Party, key: string, when: boolean, action: () => unknown) {
  const done = useRef<string | null>(null);
  const latest = useRef(action);
  latest.current = action;
  const run = useCallback(() => {
    if (!party.isHost || done.current === key) return;
    done.current = key;
    Promise.resolve(latest.current()).catch(() => {
      done.current = null;
    });
  }, [party.isHost, key]);
  useEffect(() => {
    if (party.loaded && when) run();
  }, [party.loaded, when, run]);
  return run;
}

/** Remembers what this player sent in the current round, before the move comes back from the server. */
export function useSent<T = true>(party: Party, phaseName: string) {
  const key = `${party.gid}:${party.roundNo}:${phaseName}`;
  const [sent, setSent] = useState<{ key: string; value: T } | null>(null);
  const value = sent && sent.key === key ? sent.value : undefined;
  const mark = useCallback((v: T) => setSent({ key, value: v }), [key]);
  return [value, mark] as const;
}

/** Adds round gains to the running scores. */
export function addScores(scores: Scores, gains: Scores): Scores {
  const out = { ...scores };
  for (const [id, pts] of Object.entries(gains)) out[id] = (out[id] || 0) + pts;
  return out;
}

/** Reads a numeric setting with bounds. */
export function numSetting(settings: Record<string, any>, id: string, fallback: number, min = 1, max = 999): number {
  const n = Number(settings[id]);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** Reads a list setting (categories), accepting arrays or comma-separated text. */
export function listSetting(settings: Record<string, any>, id: string): string[] {
  const v = settings[id];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v) return v.split(',').filter(Boolean);
  return [];
}
