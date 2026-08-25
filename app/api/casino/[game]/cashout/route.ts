import { NextResponse } from 'next/server';
import { getActiveRound, cashoutRound } from '@/lib/casino/roundEngine.server';

export async function POST(request: Request, { params }: { params: { game: string } }) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, params.game);
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    const result = await cashoutRound(userId, roundId, round.amount, Number(round.multiplier), params.game);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ payout: result.payout, newBalance: result.newBalance, multiplier: result.multiplier, progression: result.progression, bonuses: result.bonuses });
  } catch (err) {
    console.error('Erreur casino cashout:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
