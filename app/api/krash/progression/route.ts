import { NextResponse } from 'next/server';
import { claimChest, claimMission, claimTier, equip, loadProgression } from '@/lib/krash/progression.server';

export const dynamic = 'force-dynamic';

/** Chest, today's missions, the pass Krash and owned cosmetics. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  try {
    return NextResponse.json(await loadProgression(userId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Progression Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** chest · mission · tier · equip */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let result;
    switch (body?.action) {
      case 'chest': result = await claimChest(userId); break;
      case 'mission': result = await claimMission(userId, String(body.id ?? '')); break;
      case 'tier': result = await claimTier(userId, Number(body.tier)); break;
      case 'equip':
        if (body.kind !== 'title' && body.kind !== 'skin') {
          return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
        }
        result = await equip(userId, body.kind, body.item ? String(body.item) : null);
        break;
      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Progression Krash POST:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
