import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { clearSessionCookie, sessionUserId } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Who is signed in, from the session cookie. */
export async function GET(request: Request) {
  const uid = await sessionUserId(request);
  if (!uid) return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });

  const { data: user } = await supabase
    .from('users')
    .select('id, pseudo, avatar_url, discord_id, discord_username')
    .eq('id', uid)
    .maybeSingle();

  const res = NextResponse.json({ user: user ? { ...user, is_discord: !!user.discord_id } : null }, { headers: { 'Cache-Control': 'no-store' } });
  // The account is gone (deleted): drop the stale cookie.
  if (!user) clearSessionCookie(res);
  return res;
}
