import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';
import { setSessionCookie } from '@/lib/session';
import { allow, clearAttempts, clientIp } from '@/lib/rateLimit';

const WINDOW_SECONDS = 15 * 60;

export async function POST(request: Request) {
  try {
    const { pseudo, words } = await request.json();

    if (!pseudo || !words || words.length !== 6 || typeof pseudo !== 'string' || !Array.isArray(words)) {
      return NextResponse.json({ error: 'Pseudo et 6 mots requis' }, { status: 400 });
    }

    // Per account and per IP, counted exactly: guessing someone's six words in a loop stops here.
    const pseudoKey = `login-pseudo:${pseudo.trim().toLowerCase()}`;
    const [pseudoOk, ipOk] = await Promise.all([
      allow(pseudoKey, 8, WINDOW_SECONDS),
      allow(`login-ip:${clientIp(request)}`, 30, WINDOW_SECONDS),
    ]);
    if (!pseudoOk || !ipOk) {
      return NextResponse.json({ error: 'Trop de tentatives, réessaie dans 15 minutes.' }, { status: 429 });
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

    await clearAttempts(pseudoKey);

    // Ne pas renvoyer le hash
    const { passphrase_hash, ...safeUser } = user;

    const res = NextResponse.json({ user: safeUser });
    await setSessionCookie(res, user.id);
    return res;
  } catch (err) {
    console.error('Erreur login:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
