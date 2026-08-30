import { NextResponse } from 'next/server';
import { challengeState, startChallenge, playChallengeRound } from '@/lib/casino/challenge.server';

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('user_id');
    return NextResponse.json(await challengeState(userId));
  } catch (err) {
    console.error('Erreur GET défi:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = body?.action === 'start'
      ? await startChallenge(userId)
      : await playChallengeRound(userId, Number(body?.bet));

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur défi:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
