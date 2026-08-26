import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

/** The public tape: the last settled bets, everyone included. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 120));

    const { data } = await supabase
      .from('casino_live')
      .select('id, pseudo, game_slug, amount, multiplier, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    const rows = data || [];

    // Totals over what's on the tape, so the header means something.
    const won = rows.filter((r) => r.amount > 0).reduce((s, r) => s + Number(r.amount), 0);
    const lost = rows.filter((r) => r.amount < 0).reduce((s, r) => s - Number(r.amount), 0);

    return NextResponse.json({ live: rows, won, lost, net: won - lost });
  } catch (err) {
    console.error('Erreur GET live:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
