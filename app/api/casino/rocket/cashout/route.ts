import { NextResponse } from 'next/server';
import { getActiveRound, bustRound, cashoutRound } from '@/lib/casino/roundEngine.server';
import { multiplierAtElapsed } from '@/lib/casino/rocket';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, 'rocket');
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    const { crashPoint, startedAt } = round.state as { crashPoint: number; startedAt: number };
    const elapsed = Date.now() - startedAt;
    const currentMultiplier = multiplierAtElapsed(elapsed);

    if (currentMultiplier >= crashPoint) {
      await bustRound(userId, roundId, 'rocket', round.amount);
      return NextResponse.json({ error: `Trop tard, explosé à x${crashPoint}` }, { status: 400 });
    }

    const result = await cashoutRound(userId, roundId, round.amount, currentMultiplier, 'rocket');
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ payout: result.payout, newBalance: result.newBalance, multiplier: currentMultiplier, progression: result.progression });
  } catch (err) {
    console.error('Erreur rocket cashout:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
