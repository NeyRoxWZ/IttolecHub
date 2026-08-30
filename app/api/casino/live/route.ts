import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { reactToLive, reactionsFor, LIVE_EMOJI } from '@/lib/casino/live.server';

/** The public tape: the last settled bets, everyone included. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 120));
    const userId = searchParams.get('user_id');

    const { data } = await supabase
      .from('casino_live')
      .select('id, pseudo, game_slug, amount, multiplier, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const rows = data || [];

    // Totals over what's on the tape, so the header means something.
    const won = rows.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
    const lost = rows.filter((r) => r.amount < 0).reduce((s, r) => s - Number(r.amount), 0);

    const reactions = await reactionsFor(rows.map((r) => r.id), userId);

    return NextResponse.json({ live: rows, won, lost, net: won - lost, reactions, emoji: LIVE_EMOJI });
  } catch (err) {
    console.error('Erreur GET live:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}

/** Adds, swaps or removes this player's reaction on one feed entry. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId: string = body?.user_id;
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const result = await reactToLive(userId, Number(body?.live_id), String(body?.emoji || ''));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error('Erreur réaction:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
