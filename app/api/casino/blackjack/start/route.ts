import { NextResponse } from 'next/server';
import { startRound, cashoutRound, bustRound } from '@/lib/casino/roundEngine.server';
import { drawCard, resolveHand, isBlackjack, computeHandValue } from '@/lib/casino/blackjack';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const amount: number = Number(body?.amount);

    const playerCards = [drawCard(), drawCard()];
    const dealerCards = [drawCard(), drawCard()];

    const result = await startRound({ userId, gameSlug: 'blackjack', amount, initialState: { playerCards, dealerCards } });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    // A natural blackjack on either side ends the round right at the deal
    // — no hit/stand phase (real casino rule).
    if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
      const { outcome, multiplier } = resolveHand(playerCards, dealerCards);
      let newBalance = result.newBalance;
      if (multiplier > 0) {
        const settle = await cashoutRound(userId, result.roundId, amount, multiplier, 'blackjack');
        if (settle.ok) newBalance = settle.newBalance;
      } else {
        await bustRound(result.roundId);
      }
      return NextResponse.json({
        roundId: result.roundId, newBalance, finished: true, outcome, multiplier,
        playerCards, dealerCards, playerTotal: computeHandValue(playerCards).total, dealerTotal: computeHandValue(dealerCards).total,
      });
    }

    return NextResponse.json({
      roundId: result.roundId, newBalance: result.newBalance, finished: false,
      playerCards, dealerUpCard: dealerCards[0],
    });
  } catch (err) {
    console.error('Erreur blackjack start:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
