import { NextResponse } from 'next/server';
import {
  mySyndicate, syndicateByCode,
  createSyndicate, joinSyndicate, topUpSyndicate,
  startSyndicate, cancelSyndicate,
} from '@/lib/casino/syndicate.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const code = searchParams.get('code');

    // A code lookup is how a player peeks at a pot before paying to join it.
    const state = code ? await syndicateByCode(code, userId) : await mySyndicate(userId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('Erreur GET cagnotte:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const action: string = body?.action;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    let result;
    switch (action) {
      case 'create':
        result = await createSyndicate(
          userId, Number(body?.duration_min), Number(body?.min_buy_in), Number(body?.contribution)
        );
        break;
      case 'join':
        result = await joinSyndicate(userId, String(body?.code || ''), Number(body?.contribution));
        break;
      case 'top_up':
        result = await topUpSyndicate(userId, Number(body?.amount));
        break;
      case 'start':
        result = await startSyndicate(userId);
        break;
      case 'cancel':
        result = await cancelSyndicate(userId);
        break;
      default:
        return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur cagnotte:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
