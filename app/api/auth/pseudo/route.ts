import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { sessionUserId } from '@/lib/session';

/** Renames the signed-in player. Used to be a direct write from the browser. */
export async function POST(request: Request) {
  const uid = await sessionUserId(request);
  if (!uid) return NextResponse.json({ error: 'Connecte-toi pour continuer.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const pseudo = typeof body?.pseudo === 'string' ? body.pseudo.replace(/\s+/g, ' ').trim() : '';
  if (pseudo.length < 2 || pseudo.length > 24) {
    return NextResponse.json({ error: 'Le pseudo doit faire entre 2 et 24 caractères' }, { status: 400 });
  }

  const { data: taken } = await supabase.from('users').select('id').ilike('pseudo', pseudo).neq('id', uid).maybeSingle();
  if (taken) return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 400 });

  const { error } = await supabase.from('users').update({ pseudo }).eq('id', uid);
  if (error) return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  return NextResponse.json({ pseudo });
}
