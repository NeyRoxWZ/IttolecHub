import { NextResponse } from 'next/server';
import { getActiveRound, doubleBet, cashoutRound, bustRound } from '@/lib/casino/roundEngine.server';
import { drawCard, dealerPlay, resolveHand, computeHandValue } from '@/lib/casino/blackjack';

// Double down: only allowed on the first decision (2 cards), takes one more
// card then forces a stand — matches standard casino rules.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const roundId: string = body?.round_id;

    const roundRes = await getActiveRound(userId, roundId, 'blackjack');
    if (!roundRes.ok) return NextResponse.json({ error: roundRes.error }, { status: roundRes.status });
    const { round } = roundRes;

    const { playerCards, dealerCards } = round.state as { playerCards: number[]; dealerCards: number[] };
    if (playerCards.length !== 2) {
      return NextResponse.json({ error: 'Doubler uniquement sur les 2 premières cartes.' }, { status: 400 });
    }

    const doubled = await doubleBet(userId, roundId, 'blackjack', round.amount);
    if (!doubled.ok) return NextResponse.json({ error: doubled.error }, { status: doubled.status });

    const newPlayerCards = [...playerCards, drawCard()];
    const playerTotal = computeHandValue(newPlayerCards).total;

    if (playerTotal > 21) {
      await bustRound(roundId);
      return NextResponse.json({ busted: true, playerCards: newPlayerCards, playerTotal, newBalance: doubled.newBalance });
    }

    const finalDealerCards = dealerPlay(dealerCards);
    const { outcome, multiplier } = resolveHand(newPlayerCards, finalDealerCards);

    let newBalance = doubled.newBalance;
    if (multiplier > 0) {
      const settle = await cashoutRound(userId, roundId, doubled.newAmount, multiplier, 'blackjack');
      if (settle.ok) newBalance = settle.newBalance;
    } else {
      await bustRound(roundId);
    }

    return NextResponse.json({ busted: false, playerCards: newPlayerCards, playerTotal, dealerCards: finalDealerCards, outcome, multiplier, newBalance });
  } catch (err) {
    console.error('Erreur blackjack double:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
