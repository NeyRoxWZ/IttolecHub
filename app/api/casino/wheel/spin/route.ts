import { NextResponse } from 'next/server';
import { spinWheel, resolveWheelBet, type WheelBet } from '@/lib/casino/wheel';
import { settleBet } from '@/lib/casino/settleBet.server';

// RNG and payout are resolved here, server-side, with the service-role key.
// The client never gets to submit or influence the result — it only ever
// sees what this route returns.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    const bet: WheelBet = body?.bet;
    const amount: number = Number(body?.amount);

    if (!userId || !bet || !bet.type || bet.value === undefined || bet.value === null) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }

    const result = await settleBet({
      userId,
      gameSlug: 'wheel',
      amount,
      resolve: () => {
        const landedNumber = spinWheel();
        const { won, multiplier } = resolveWheelBet(landedNumber, bet);
        return { won, multiplier, meta: { bet, landedNumber } };
      },
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      landedNumber: result.meta.landedNumber,
      won: result.won,
      multiplier: result.multiplier,
      payout: result.payout,
      netChange: result.netChange,
      newBalance: result.newBalance,
      progression: result.progression,
      bonuses: result.bonuses,
    });
  } catch (err) {
    console.error('Erreur spin wheel:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
