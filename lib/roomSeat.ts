/**
 * A player's seat in a room, remembered on this device.
 *
 * The seat used to live in sessionStorage only, so closing the tab, a phone
 * dropping the page or opening the link elsewhere lost it: the player came back
 * as a stranger and the running game no longer knew them. Kept here per room
 * for a day, it lets them walk straight back into their place.
 */
import { roomDb } from '@/lib/supabase/roomClient';

export interface RememberedSeat { playerId: string; name: string }

const DAY_MS = 24 * 60 * 60 * 1000;
const key = (code: string) => `itollec_seat:${code.toUpperCase()}`;

export function rememberSeat(code: string, seat: RememberedSeat) {
  try { localStorage.setItem(key(code), JSON.stringify({ ...seat, at: Date.now() })); } catch {}
}

export function recallSeat(code: string): RememberedSeat | null {
  try {
    const s = JSON.parse(localStorage.getItem(key(code)) || 'null');
    if (!s?.playerId || !s?.name || Date.now() - Number(s.at || 0) > DAY_MS) return null;
    return { playerId: String(s.playerId), name: String(s.name) };
  } catch {
    return null;
  }
}

export function forgetSeat(code: string) {
  try { localStorage.removeItem(key(code)); } catch {}
}

/** Presence is sent every 30 s (and on coming back to the tab): past this, a player is away. */
export const ABSENT_MS = 45_000;
/** Past this, the host is gone and the next active player takes over (the server uses the same figure). */
export const HOST_GONE_MS = 75_000;

export const isAway = (lastSeen?: string | null, ms = ABSENT_MS) =>
  !lastSeen || Date.now() - new Date(lastSeen).getTime() > ms;

interface SeatRow { id: string; joined_at?: string | null; last_seen_at?: string | null }

/**
 * When the host has stopped sending presence, the active player who joined
 * first takes over — every client computes the same answer, so only that one
 * writes. Returns true when this player just became host.
 */
export async function takeOverIfHostGone(roomId: string, me: string, hostId: string | null | undefined, players: SeatRow[]): Promise<boolean> {
  if (!roomId || !me || hostId === me) return false;
  const host = players.find((p) => p.id === hostId);
  if (host && !isAway(host.last_seen_at, HOST_GONE_MS)) return false;

  const next = players
    .filter((p) => p.id !== hostId && !isAway(p.last_seen_at))
    .sort((a, b) => String(a.joined_at || '').localeCompare(String(b.joined_at || '')) || a.id.localeCompare(b.id))[0];
  if (!next || next.id !== me) return false;

  const { error } = await roomDb.from('rooms').update({ host_id: me }).eq('id', roomId);
  if (error) return false;
  await roomDb.from('players').update({ is_host: true }).eq('id', me);
  if (hostId) await roomDb.from('players').update({ is_host: false }).eq('id', hostId);
  return true;
}
