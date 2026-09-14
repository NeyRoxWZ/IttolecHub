import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { setSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Signs a Discord player in. The browser hands over the Supabase access token
 * it got back from Discord; the server checks it with Supabase, finds or
 * creates the matching account, and sets the session cookie. Creating the
 * account used to happen in the browser, which let anyone write to `users`.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.access_token === 'string' ? body.access_token : '';
  if (!token) return NextResponse.json({ error: 'Jeton Discord manquant' }, { status: 400 });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: 'Connexion Discord expirée, recommence.' }, { status: 401 });

  const meta = data.user.user_metadata || {};
  const discordId = String(meta.provider_id || data.user.id);
  const discordUsername = String(meta.full_name || meta.name || 'Joueur Discord').slice(0, 32);
  const avatarUrl = typeof meta.avatar_url === 'string' ? meta.avatar_url : null;

  let { data: user } = await supabase
    .from('users')
    .select('id, pseudo, avatar_url, discord_id, discord_username')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (!user) {
    // A new account needs the Conditions accepted first.
    if (body?.consent !== true) return NextResponse.json({ needsConsent: true });

    let pseudo = discordUsername.replace(/\s+/g, ' ').trim() || 'Joueur';
    for (let i = 0; i < 5; i++) {
      const { data: taken } = await supabase.from('users').select('id').ilike('pseudo', pseudo).maybeSingle();
      if (!taken) break;
      pseudo = `${discordUsername.slice(0, 26)}${Math.floor(Math.random() * 10000)}`;
    }

    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert([{ pseudo, discord_id: discordId, discord_username: discordUsername, avatar_url: avatarUrl }])
      .select('id, pseudo, avatar_url, discord_id, discord_username')
      .single();
    if (insertError || !created) {
      console.error('Création compte Discord:', insertError);
      return NextResponse.json({ error: 'Création du compte impossible' }, { status: 500 });
    }
    user = created;
  }

  const res = NextResponse.json({ user: { ...user, is_discord: true } });
  await setSessionCookie(res, user.id);
  return res;
}
