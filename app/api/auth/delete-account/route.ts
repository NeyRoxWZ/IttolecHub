import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase/server';
import { clearSessionCookie } from '@/lib/session';

/**
 * Deletes an account and everything attached to it. Game data goes with the
 * row through the foreign keys; the few references that do not cascade are
 * cleared first.
 *
 * A passphrase account proves itself with its six words, a Discord account
 * with its current session token.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const userId = String(body?.user_id ?? '');
    if (!userId || body?.confirm !== 'SUPPRIMER') {
      return NextResponse.json({ error: 'Confirmation manquante' }, { status: 400 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, pseudo, passphrase_hash, discord_id')
      .eq('id', userId)
      .maybeSingle();
    if (!user) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 });

    let authUserId: string | null = null;
    if (user.passphrase_hash) {
      const words = Array.isArray(body?.words) ? body.words.map((w: unknown) => String(w).trim()) : [];
      if (words.length !== 6 || !(await bcrypt.compare(words.join(' ').toLowerCase(), user.passphrase_hash))) {
        return NextResponse.json({ error: 'Les 6 mots ne correspondent pas' }, { status: 403 });
      }
    } else if (user.discord_id) {
      const token = String(body?.access_token ?? '');
      const { data } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
      const discordId = data.user?.user_metadata?.provider_id || data.user?.id;
      if (!data.user || discordId !== user.discord_id) {
        return NextResponse.json({ error: 'Reconnecte-toi avec Discord puis réessaie' }, { status: 403 });
      }
      authUserId = data.user.id;
    } else {
      return NextResponse.json({ error: 'Compte impossible à vérifier' }, { status: 403 });
    }

    // The only reference to users without ON DELETE: last jackpot winner.
    await supabase.from('casino_jackpot').update({ last_winner_user_id: null }).eq('last_winner_user_id', user.id);

    const { error } = await supabase.from('users').delete().eq('id', user.id);
    if (error) {
      console.error('Suppression de compte:', error);
      return NextResponse.json({ error: 'Suppression impossible, écris-nous' }, { status: 500 });
    }

    // The Discord sign-in record too, so nothing is left behind.
    if (authUserId) {
      try { await supabase.auth.admin.deleteUser(authUserId); } catch (err) { console.error('Suppression auth Discord:', err); }
    }

    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    console.error('Erreur suppression de compte:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
