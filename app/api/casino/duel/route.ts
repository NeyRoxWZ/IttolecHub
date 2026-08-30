import { NextResponse } from 'next/server';
import { duelState, createDuel, joinDuel, playDuel, cancelDuel } from '@/lib/casino/duel.server';

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('user_id');
    return NextResponse.json(await duelState(userId));
  } catch (err) {
    console.error('Erreur GET duel:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let result;
    switch (body?.action) {
      case 'create': result = await createDuel(userId, String(body?.game || ''), Number(body?.amount)); break;
      case 'join':   result = await joinDuel(userId, String(body?.code || '')); break;
      case 'play':   result = await playDuel(userId, String(body?.duel_id || '')); break;
      case 'cancel': result = await cancelDuel(userId, String(body?.duel_id || '')); break;
      default: return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur duel:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
