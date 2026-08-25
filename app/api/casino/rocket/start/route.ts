import { NextResponse } from 'next/server';
import { startRound } from '@/lib/casino/roundEngine.server';
import { generateCrashPoint } from '@/lib/casino/rocket';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const amount: number = Number(body?.amount);

    const crashPoint = generateCrashPoint(); // secret, never sent to the client
    const startedAt = Date.now();

    const result = await startRound({ userId, gameSlug: 'rocket', amount, initialState: { crashPoint, startedAt } });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ roundId: result.roundId, newBalance: result.newBalance, startedAt });
  } catch (err) {
    console.error('Erreur rocket start:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
