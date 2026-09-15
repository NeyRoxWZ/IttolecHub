import { NextResponse } from 'next/server';
import { giftsFor, sendGift } from '@/lib/casino/social.server';
import { nudgeCommunity } from '@/lib/casino/community.server';
import { allow } from '@/lib/rateLimit';

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
    // Anti-spam: gifts carry a message another player receives.
    if (!(await allow(`gift:${userId}`, 20, 10 * 60))) {
      return NextResponse.json({ error: 'Trop de cadeaux envoyés, réessaie dans quelques minutes.' }, { status: 429 });
    }

    const result = await sendGift(
      userId,
      String(body?.to || ''),
      Number(body?.amount) || 0,
      String(body?.message || ''),
      body?.item_id ? String(body.item_id) : undefined,
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await nudgeCommunity(userId, { gifts: 1 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur cadeau:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
