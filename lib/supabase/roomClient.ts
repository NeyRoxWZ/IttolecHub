/**
 * The room client: writes to the multiplayer tables go through the server
 * (/api/room-db) instead of straight to Supabase, with the same chain syntax
 * the games already use:
 *
 *   await roomDb.from('rooms').update({ status: 'in_game' }).eq('id', roomId);
 *
 * Taking a seat in a room returns a signed seat token, kept for this tab and
 * sent with every later write; the server only lets it act inside that room.
 * Reads and realtime stay on the regular Supabase client.
 */

const TOKEN_KEY = 'itollec_room_token';

type Result = { data: any; error: { message: string; code?: string; details?: string; hint?: string } | null };
type Filter = ['eq' | 'lt', string, unknown] | ['match', Record<string, unknown>];

/**
 * This tab's token, else the last one this device held: a player whose tab was
 * closed or reloaded by the phone comes back with it (the server still checks
 * it names this room and this seat).
 */
function readToken(): string {
  try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

/** The seat a token names (read only: the server checks the signature). */
function seatOf(token: string): { pid: string; rid: string } | null {
  try {
    const body = token.split('.')[0];
    if (!body) return null;
    const json = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof json?.pid !== 'string' || typeof json?.rid !== 'string') return null;
    if (typeof json.exp === 'number' && json.exp * 1000 < Date.now()) return null;
    return { pid: json.pid, rid: json.rid };
  } catch {
    return null;
  }
}

function keepToken(token?: string) {
  if (!token) return;
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

async function send(body: Record<string, unknown>): Promise<Result> {
  try {
    const res = await fetch('/api/room-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-room-token': readToken() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    keepToken(json?.token);
    if (json && 'data' in json) return { data: json.data ?? null, error: json.error ?? null };
    return { data: null, error: { message: `Erreur ${res.status}` } };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Réseau indisponible' } };
  }
}

class RoomQuery implements PromiseLike<Result> {
  private op: 'insert' | 'update' | 'delete' | 'upsert' = 'update';
  private values: unknown = undefined;
  private filters: Filter[] = [];
  private selectCols: string | null = null;
  private singleMode: 'single' | 'maybe' | null = null;
  private onConflict: string | undefined;

  constructor(private readonly table: string) {}

  insert(values: unknown) { this.op = 'insert'; this.values = values; return this; }
  upsert(values: unknown, options?: { onConflict?: string }) { this.op = 'upsert'; this.values = values; this.onConflict = options?.onConflict; return this; }
  update(values: unknown) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }

  eq(column: string, value: unknown) { this.filters.push(['eq', column, value]); return this; }
  lt(column: string, value: unknown) { this.filters.push(['lt', column, value]); return this; }
  match(query: Record<string, unknown>) { this.filters.push(['match', query]); return this; }

  select(columns = '*') { this.selectCols = columns; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }

  then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return send({
      table: this.table,
      op: this.op,
      values: this.values,
      filters: this.filters,
      select: this.selectCols,
      single: this.singleMode,
      onConflict: this.onConflict,
    }).then(onfulfilled, onrejected);
  }
}

export const roomDb = {
  from: (table: string) => new RoomQuery(table),

  /**
   * A returning player takes their seat back (same room, by id or by name).
   * Skipped when this tab already holds that seat's token: the server refuses
   * to hand out a seat whose player is still active.
   */
  claim: async (roomId: string, who: { playerId?: string; name?: string }): Promise<Result> => {
    const held = seatOf(readToken());
    if (held && held.rid === roomId && (!who.playerId || held.pid === who.playerId)) {
      return { data: { id: held.pid }, error: null };
    }
    return send({ op: 'claim', roomId, playerId: who.playerId, name: who.name });
  },
};
