import { NextResponse } from 'next/server';
import { drawCard } from '@/lib/casino/hilo';
import { signCard } from '@/lib/casino/signCard.server';

export const dynamic = 'force-dynamic';

// Free preview draw (no money touched) so the client can show the current
// card + its live payout before the player commits a bet + direction.
export async function GET() {
  const card = drawCard();
  return NextResponse.json({ card, token: signCard(card) });
}
