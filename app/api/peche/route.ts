import { NextResponse } from 'next/server';
import { isOwner } from '@/lib/owner';
import {
  autoFish, buyItem, buyPack, buyTree, cast, claimAchievement, claimBoss, claimChest, claimMission, claimPassTier,
  communityFor, deliverOrder, equip, openPack, playerCard, prestige, reel, seeRecap, sell, stateFor, travel, upgrade,
} from '@/lib/peche/server';
import type { CosmeticSlot, GearId, TreeId } from '@/lib/peche/data';

export const dynamic = 'force-dynamic';

/** Under construction: only the owner's account may play. */
function gate(userId: string | null | undefined) {
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  if (!isOwner(userId)) return NextResponse.json({ error: 'Frenly Pêche est en construction.' }, { status: 403 });
  return null;
}

const noStore = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const userId = params.get('user_id');
  const blocked = gate(userId);
  if (blocked) return blocked;

  if (params.get('view') === 'community') return NextResponse.json({ community: await communityFor(userId!) }, noStore);

  const card = params.get('card');
  if (card) {
    const data = await playerCard(card);
    if (!data) return NextResponse.json({ error: 'Pêcheur introuvable' }, { status: 404 });
    return NextResponse.json({ card: data }, noStore);
  }

  const state = await stateFor(userId!);
  if (!state) return NextResponse.json({ error: 'Joueur introuvable' }, { status: 404 });
  return NextResponse.json({ state }, noStore);
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
      case 'chest': out = await claimChest(userId); break;
      case 'mission': out = await claimMission(userId, body?.scope === 'weekly' ? 'weekly' : 'daily', Number(body?.index)); break;
      case 'deliver': out = await deliverOrder(userId, String(body?.order_id || '')); break;
      case 'buy_item': out = await buyItem(userId, String(body?.item || '')); break;
      case 'buy_pack': out = await buyPack(userId); break;
      case 'open_pack': out = await openPack(userId, Number(body?.count) || 1); break;
      case 'equip': out = await equip(userId, String(body?.slot) as CosmeticSlot, body?.cosmetic_id ? String(body.cosmetic_id) : null); break;
      case 'achievement': out = await claimAchievement(userId, String(body?.id || '')); break;
      case 'pass': out = await claimPassTier(userId, Number(body?.tier)); break;
      case 'recap_seen': out = await seeRecap(userId); break;
      case 'boss': out = await claimBoss(userId); break;
      default: return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json({ result: out.result, state: out.state });
  } catch (err) {
    console.error('Erreur pêche:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
