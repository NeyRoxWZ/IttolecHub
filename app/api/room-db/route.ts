import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { readPayload, signPayload } from '@/lib/session';
import { clientIp, underLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Every write the multiplayer rooms and games make, done by the server.
 *
 * The browser used to write these tables directly with the public key, so
 * anyone could change or wipe any room. Now the room client (roomDb) sends the
 * write here, and:
 * - opening a room and taking a seat stay open to whoever has the code;
 * - taking a seat returns a signed seat token (player + room);
 * - every other write needs that token and is forced inside its room.
 * Reads and realtime still go straight to Supabase: they are not sensitive.
 */

const TABLES = new Set([
  'rooms', 'players', 'game_sessions', 'game_moves', 'game_state', 'game_votes', 'game_players', 'draw_strokes',
  'undercover_games', 'undercover_players', 'undercover_clues', 'undercover_votes',
  'infiltre_games', 'infiltre_players', 'infiltre_questions', 'infiltre_votes',
  'flag_games', 'flag_players', 'wiki_games', 'wiki_players', 'budget_games', 'budget_players',
  'draw_games', 'draw_players', 'poke_games', 'poke_players', 'rent_games', 'rent_players', 'logo_games', 'logo_players',
]);
const OPS = new Set(['insert', 'update', 'delete', 'upsert']);
const IDENT = /^[a-z_]+$/;
const SEAT_MAX_AGE = 60 * 60 * 24;

type Row = Record<string, unknown>;
type Filter = ['eq' | 'lt', string, unknown] | ['match', Row];
type Seat = { typ: 'seat'; pid: string; rid: string };

const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status: number, message: string) => reply({ data: null, error: { message } }, status);
const seatToken = (pid: string, rid: string) => signPayload({ typ: 'seat', pid, rid }, SEAT_MAX_AGE);
const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const keysOk = (r: Row) => Object.keys(r).every((k) => IDENT.test(k));
const pick = (r: Row, allowed: string[]) => Object.fromEntries(Object.entries(r).filter(([k]) => allowed.includes(k)));

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRow(body)) return fail(400, 'Requête invalide');

  /* ---- a returning player takes their seat back (by id or by name, as before) ---- */
  if (body.op === 'claim') {
    const roomId = typeof body.roomId === 'string' ? body.roomId : '';
    const playerId = typeof body.playerId === 'string' ? body.playerId : '';
    const name = typeof body.name === 'string' ? body.name : '';
    if (!roomId || (!playerId && !name)) return fail(400, 'Salon ou joueur manquant');
    let q = supabase.from('players').select('id, room_id').eq('room_id', roomId);
    q = playerId ? q.eq('id', playerId) : q.eq('name', name);
    const { data: player } = await q.maybeSingle();
    if (!player) return fail(404, 'Joueur introuvable dans ce salon');
    return reply({ data: { id: player.id }, error: null, token: await seatToken(player.id, player.room_id) });
  }

  const table = typeof body.table === 'string' ? body.table : '';
  const op = typeof body.op === 'string' ? body.op : '';
  if (!TABLES.has(table)) return fail(400, 'Table inconnue');
  if (!OPS.has(op)) return fail(400, 'Opération inconnue');

  const filters: Filter[] = [];
  for (const f of Array.isArray(body.filters) ? body.filters : []) {
    if (Array.isArray(f) && f[0] === 'match' && isRow(f[1]) && keysOk(f[1])) filters.push(['match', f[1]]);
    else if (Array.isArray(f) && (f[0] === 'eq' || f[0] === 'lt') && typeof f[1] === 'string' && IDENT.test(f[1])) filters.push([f[0], f[1], f[2]]);
    else return fail(400, 'Filtre invalide');
  }

  let values: unknown = body.values;
  const rows: Row[] = Array.isArray(values) ? values.filter(isRow) : isRow(values) ? [values] : [];
  if (op !== 'delete' && (rows.length === 0 || !rows.every(keysOk))) return fail(400, 'Valeurs invalides');

  const open = op === 'insert' && (table === 'rooms' || table === 'players');
  let seat: Seat | null = null;

  if (open) {
    if (!isRow(values)) return fail(400, 'Un seul élément à la fois');
    if (table === 'rooms') {
      if (!(await underLimit(`room-create:${clientIp(request)}`))) return fail(429, 'Trop de salons créés, réessaie dans une minute.');
      values = pick(values, ['code', 'host_id', 'status', 'game_type', 'settings']);
    } else {
      const roomId = typeof values.room_id === 'string' ? values.room_id : '';
      const { data: room } = await supabase.from('rooms').select('id, settings').eq('id', roomId).maybeSingle();
      if (!room) return fail(404, 'Salon introuvable');
      const banned: unknown[] = Array.isArray((room.settings as Row | null)?.banned) ? ((room.settings as Row).banned as unknown[]) : [];
      if (banned.includes(values.name)) return fail(403, 'Tu as été exclu de ce salon.');
      values = pick(values, ['room_id', 'name', 'is_host', 'score', 'avatar']);
    }
  } else {
    seat = await readPayload<Seat>(request.headers.get('x-room-token'));
    if (!seat || seat.typ !== 'seat' || typeof seat.rid !== 'string') return fail(401, 'Rejoins le salon pour jouer.');
    const rid = seat.rid;

    if (op === 'insert' || op === 'upsert') {
      if (table === 'rooms') return fail(403, 'Opération non autorisée');
      for (const r of rows) {
        if (r.room_id !== undefined && r.room_id !== rid) return fail(403, 'Ce salon n’est pas le tien.');
        r.room_id = rid;
      }
      values = Array.isArray(values) ? rows : rows[0];
    } else {
      if (op === 'update') {
        const v = rows[0];
        if (v.room_id !== undefined && v.room_id !== rid) return fail(403, 'Ce salon n’est pas le tien.');
        if (table === 'rooms' && v.id !== undefined && v.id !== rid) return fail(403, 'Ce salon n’est pas le tien.');
      }
      // Updates and deletes never reach outside the seat's room.
      filters.push(['eq', table === 'rooms' ? 'id' : 'room_id', rid]);
    }
  }

  const base = supabase.from(table);
  let q: any;
  if (op === 'insert') q = base.insert(values as Row | Row[]);
  else if (op === 'upsert') {
    const onConflict = typeof body.onConflict === 'string' && /^[a-z_,]+$/.test(body.onConflict) ? body.onConflict : undefined;
    q = base.upsert(values as Row | Row[], onConflict ? { onConflict } : undefined);
  } else if (op === 'update') q = base.update(values as Row);
  else q = base.delete();

  if (op === 'update' || op === 'delete') {
    for (const f of filters) q = f[0] === 'match' ? q.match(f[1]) : f[0] === 'eq' ? q.eq(f[1], f[2]) : q.lt(f[1], f[2]);
  }

  // A new seat must know its player id to sign the token.
  const wantsRow = open && table === 'players';
  if (wantsRow || body.select) q = q.select(typeof body.select === 'string' && /^[a-z_,*\s]+$/.test(body.select) ? body.select : '*');
  if (wantsRow || body.single === 'maybe') q = q.maybeSingle();
  else if (body.single === 'single') q = q.single();

  const { data, error } = await q;
  let token: string | undefined;
  if (!error && wantsRow && isRow(data) && typeof data.id === 'string' && typeof data.room_id === 'string') {
    token = await seatToken(data.id, data.room_id);
  }
  return reply({ data: data ?? null, error: error ? { message: error.message, code: error.code } : null, token });
}
