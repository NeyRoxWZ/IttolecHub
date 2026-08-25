import { NextResponse } from 'next/server';
import { getActiveRound, cashoutRound, bustRound } from '@/lib/casino/roundEngine.server';
import { dealerPlay, resolveHand } from '@/lib/casino/blackjack';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, 'blackjack');
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    const { playerCards, dealerCards } = round.state as { playerCards: number[]; dealerCards: number[] };
    const finalDealerCards = dealerPlay(dealerCards);
    const { outcome, multiplier } = resolveHand(playerCards, finalDealerCards);

    let newBalance: number | undefined;
    if (multiplier > 0) {
      const settle = await cashoutRound(userId, roundId, round.amount, multiplier, 'blackjack');
      if (!settle.ok) return NextResponse.json({ error: settle.error }, { status: settle.status });
      newBalance = settle.newBalance;
    } else {
      await bustRound(roundId);
    }

    return NextResponse.json({ outcome, multiplier, dealerCards: finalDealerCards, newBalance });
  } catch (err) {
    console.error('Erreur blackjack stand:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
