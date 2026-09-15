import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COLUMN = { founder: 'is_founder', og: 'is_og', donor: 'is_donor' } as const;
type Badge = keyof typeof COLUMN;

/**
 * A player shows or hides one of their badges. Server side on purpose: the only
 * field this route can touch is `hidden_badges`, and only for a badge the
 * account really has — nobody can give themselves a badge from here.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userId = typeof body?.user_id === 'string' ? body.user_id : '';
  const badge = body?.badge as Badge;
  const visible = body?.visible === true;
  if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });
  if (!(badge in COLUMN)) return NextResponse.json({ error: 'Badge inconnu' }, { status: 400 });

  const { data: row, error: readError } = await supabase
    .from('users')
    .select('is_og, is_founder, is_donor, hidden_badges')
    .eq('id', userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  if (!row || row[COLUMN[badge]] !== true) return NextResponse.json({ error: 'Ce compte n’a pas ce badge.' }, { status: 403 });

  const hidden = new Set<string>((row.hidden_badges as string[] | null) || []);
  if (visible) hidden.delete(badge); else hidden.add(badge);

  const { error } = await supabase.from('users').update({ hidden_badges: Array.from(hidden) }).eq('id', userId);
  if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  return NextResponse.json({ hidden: Array.from(hidden) });
}
