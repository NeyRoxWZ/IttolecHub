import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * An OG shows or hides their badge. Server side on purpose: the only field
 * this route can touch is `og_badge_visible`, and only on an OG account —
 * nobody can make themselves OG from here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const visible = body?.visible === true;
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

  const { data, error } = await supabase
    .from('users')
    .update({ og_badge_visible: visible })
    .eq('id', userId)
    .or('is_og.eq.true,is_founder.eq.true')
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Ce compte n’a pas de badge OG.' }, { status: 403 });
  return NextResponse.json({ visible });
}
