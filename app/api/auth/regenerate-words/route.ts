import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { userId, words } = await request.json();

    if (!userId || !words || words.length !== 6) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const passphrase = words.join(' ').toLowerCase();
    const hash = await bcrypt.hash(passphrase, 10);

    const { error } = await supabase
      .from('users')
      .update({ passphrase_hash: hash })
      .eq('id', userId);

    if (error) {
      console.error('Erreur Supabase update:', error);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erreur regenerate:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
