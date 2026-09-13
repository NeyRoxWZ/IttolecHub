import { NextResponse } from 'next/server';
import { closeAll, closePosition, loadPositions, openPosition } from '@/lib/krash/trade.server';

export const dynamic = 'force-dynamic';

/** A player's positions, with anything that broke while they were away liquidated first. */
export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get('user_id');
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  try {
    return NextResponse.json(await loadPositions(userId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Positions Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** open · close · close_all */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let result;
    switch (body?.action) {
      case 'open':
        result = await openPosition(userId, {
          asset: String(body.asset ?? ''),
          side: String(body.side ?? ''),
          leverage: Number(body.leverage),
          stake: Number(body.stake),
          duration: body.duration == null ? null : Number(body.duration),
        });
        break;
      case 'close':
        result = await closePosition(userId, String(body.position_id ?? ''));
        break;
      case 'close_all':
        result = await closeAll(userId);
        break;
      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Trade Krash:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
