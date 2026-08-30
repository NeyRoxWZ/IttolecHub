import { NextResponse } from 'next/server';
import { giftsFor, sendGift } from '@/lib/casino/social.server';

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
    return NextResponse.json(await giftsFor(userId));
  } catch (err) {
    console.error('Erreur GET cadeaux:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = await sendGift(
      userId,
      String(body?.to || ''),
      Number(body?.amount) || 0,
      String(body?.message || ''),
      body?.item_id ? String(body.item_id) : undefined,
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur cadeau:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
