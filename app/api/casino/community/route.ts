import { NextResponse } from 'next/server';
import { communityState, claimCommunity } from '@/lib/casino/community.server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    return NextResponse.json(await communityState(userId));
  } catch (err) {
    console.error('Erreur GET objectif commun:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = await claimCommunity(userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, reward: result.reward, newBalance: result.newBalance });
  } catch (err) {
    console.error('Erreur claim objectif commun:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
