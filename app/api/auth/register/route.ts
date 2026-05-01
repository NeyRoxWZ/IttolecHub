import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { pseudo, words } = await request.json();

    if (!pseudo || !words || words.length !== 6) {
      return NextResponse.json({ error: 'Pseudo et 6 mots requis' }, { status: 400 });
    }

    // Vérifier si le pseudo existe déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('pseudo', pseudo)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 400 });
    }

    const passphrase = words.join(' ').toLowerCase();
    const hash = await bcrypt.hash(passphrase, 10);

    // Insérer l'utilisateur
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([
        {
          pseudo,
          passphrase_hash: hash,
        }
      ])
      .select('id, pseudo, avatar_url')
      .single();

    if (error) {
      console.error('Erreur Supabase insert:', error);
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 });
    }

    return NextResponse.json({ user: newUser });
  } catch (err) {
    console.error('Erreur register:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
