import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

/** Recent big wins, shown as a live ticker in the casino hub. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(30, Math.max(1, Number(searchParams.get('limit')) || 15));

    const { data } = await supabase
      .from('casino_feed')
      .select('id, pseudo, game_slug, amount, multiplier, pinned, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    return NextResponse.json({ feed: data || [] });
  } catch (err) {
    console.error('Erreur GET feed:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
