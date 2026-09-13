import { NextResponse } from 'next/server';
import { isOwner } from '@/lib/owner';
import { autoFish, buyTree, cast, prestige, reel, sell, stateFor, travel, upgrade } from '@/lib/peche/server';
import type { GearId, TreeId } from '@/lib/peche/data';

export const dynamic = 'force-dynamic';

/** Under construction: only the owner's account may play. */
function gate(userId: string | null | undefined) {
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  if (!isOwner(userId)) return NextResponse.json({ error: 'Frenly Pêche est en construction.' }, { status: 403 });
  return null;
}

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  const blocked = gate(userId);
  if (blocked) return blocked;
  const state = await stateFor(userId!);
  if (!state) return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });
  return NextResponse.json({ state }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const blocked = gate(userId);
    if (blocked) return blocked;

    let out;
    switch (body?.action) {
      case 'cast': out = await cast(userId); break;
      case 'reel': out = await reel(userId, String(body?.cast_id || ''), body?.quality === 'perfect' ? 'perfect' : body?.quality === 'good' ? 'good' : 'fail'); break;
      case 'auto': out = await autoFish(userId); break;
      case 'sell': out = await sell(userId, body?.key ? String(body.key) : undefined); break;
      case 'upgrade': out = await upgrade(userId, String(body?.gear) as GearId); break;
      case 'travel': out = await travel(userId, Number(body?.zone)); break;
      case 'prestige': out = await prestige(userId); break;
      case 'tree': out = await buyTree(userId, String(body?.node) as TreeId); break;
      default: return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json({ result: out.result, state: out.state });
  } catch (err) {
    console.error('Erreur pêche:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
