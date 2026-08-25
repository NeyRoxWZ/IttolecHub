import { NextResponse } from 'next/server';
import { getActiveRound, updateRoundState, bustRound } from '@/lib/casino/roundEngine.server';
import { drawCard, computeHandValue } from '@/lib/casino/blackjack';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, 'blackjack');
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    const { playerCards, dealerCards } = round.state as { playerCards: number[]; dealerCards: number[] };
    const newPlayerCards = [...playerCards, drawCard()];
    const { total } = computeHandValue(newPlayerCards);

    if (total > 21) {
      const progression = await bustRound(userId, roundId, 'blackjack', round.amount);
      return NextResponse.json({ busted: true, playerCards: newPlayerCards, playerTotal: total, dealerCards, progression });
    }

    await updateRoundState(roundId, { playerCards: newPlayerCards, dealerCards }, Number(round.multiplier));
    return NextResponse.json({ busted: false, playerCards: newPlayerCards, playerTotal: total });
  } catch (err) {
    console.error('Erreur blackjack hit:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
