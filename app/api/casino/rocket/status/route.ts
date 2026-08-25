import { NextResponse } from 'next/server';
import { getActiveRound, bustRound } from '@/lib/casino/roundEngine.server';
import { multiplierAtElapsed } from '@/lib/casino/rocket';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Read-only poll so the client can show "CRASHED" proactively instead of
// only finding out when it tries to cash out. Lazily marks the round
// busted server-side once elapsed time has passed the (secret) crash point.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || '';
    const roundId = searchParams.get('round_id') || '';

    const { data: round } = await supabase.from('casino_rounds').select('*').eq('id', roundId).eq('user_id', userId).eq('game_slug', 'rocket').maybeSingle();
    if (!round) return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 });

    if (round.status !== 'active') {
      return NextResponse.json({ status: round.status, crashPoint: round.state?.crashPoint ?? null });
    }

    const { crashPoint, startedAt } = round.state as { crashPoint: number; startedAt: number };
    const elapsed = Date.now() - startedAt;
    const currentMultiplier = multiplierAtElapsed(elapsed);

    if (currentMultiplier >= crashPoint) {
      await bustRound(roundId);
      return NextResponse.json({ status: 'busted', crashPoint });
    }

    return NextResponse.json({ status: 'active', multiplier: currentMultiplier });
  } catch (err) {
    console.error('Erreur rocket status:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
