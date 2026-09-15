import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';
import { setSessionCookie } from '@/lib/session';
import { allow, clientIp } from '@/lib/rateLimit';

export async function POST(request: Request) {
  try {
    const { pseudo, words, website } = await request.json();

    // Anti-spam trap: the form has a "website" field people never see or fill.
    // Bots filling every field get a plain refusal, without learning why.
    if (typeof website === 'string' && website.trim() !== '') {
      return NextResponse.json({ error: 'Impossible de créer le compte.' }, { status: 400 });
    }

    if (!pseudo || !words || words.length !== 6) {
      return NextResponse.json({ error: 'Pseudo et 6 mots requis' }, { status: 400 });
    }
    if (typeof pseudo !== 'string' || !Array.isArray(words) || !words.every((w: unknown) => typeof w === 'string' && w.length > 0 && w.length <= 32)) {
      return NextResponse.json({ error: 'Pseudo et 6 mots requis' }, { status: 400 });
    }
    const cleanPseudo = pseudo.replace(/\s+/g, ' ').trim();
    if (cleanPseudo.length < 2 || cleanPseudo.length > 24 || cleanPseudo !== pseudo) {
      return NextResponse.json({ error: 'Le pseudo doit faire entre 2 et 24 caractères, sans espaces en trop.' }, { status: 400 });
    }

    if (!(await allow(`register-ip:${clientIp(request)}`, 5, 60 * 60))) {
      return NextResponse.json({ error: 'Trop de comptes créés, réessaie dans une heure.' }, { status: 429 });
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

    const res = NextResponse.json({ user: newUser });
    await setSessionCookie(res, newUser.id);
    return res;
  } catch (err) {
    console.error('Erreur register:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
