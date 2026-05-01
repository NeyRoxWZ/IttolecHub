import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { pseudo, words } = await request.json();

    if (!pseudo || !words || words.length !== 6) {
      return NextResponse.json({ error: 'Pseudo et 6 mots requis' }, { status: 400 });
    }

    // Récupérer l'utilisateur
    const { data: user, error } = await supabase
      .from('users')
      .select('id, pseudo, passphrase_hash, avatar_url')
      .eq('pseudo', pseudo)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 400 });
    }

    if (!user.passphrase_hash) {
      return NextResponse.json({ error: 'Ce compte utilise une autre méthode de connexion (ex: Discord)' }, { status: 400 });
    }

    const passphrase = words.join(' ').toLowerCase();
    const isMatch = await bcrypt.compare(passphrase, user.passphrase_hash);

    if (!isMatch) {
      return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 400 });
    }

    // Ne pas renvoyer le hash
    const { passphrase_hash, ...safeUser } = user;

    return NextResponse.json({ user: safeUser });
  } catch (err) {
    console.error('Erreur login:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
