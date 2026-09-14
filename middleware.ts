import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession } from '@/lib/session';

/**
 * Guards every API route: a request that names a player (`user_id` or
 * `userId`, in the query or the body) must carry that player's session cookie.
 * The routes keep reading the id from the request as before; this makes sure
 * it can no longer be someone else's.
 */

// Routes that sign people in or out, or are called by the platform itself.
const OPEN = ['/api/auth/login', '/api/auth/register', '/api/auth/discord', '/api/auth/me', '/api/auth/logout', '/api/casino/push/send', '/api/pwa-icon'];
const ID_KEYS = ['user_id', 'userId'];

export const config = { matcher: '/api/:path*' };

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (OPEN.some((p) => path === p || path.startsWith(`${p}/`))) return NextResponse.next();

  const claimed = new Set<string>();
  for (const k of ID_KEYS) {
    const v = req.nextUrl.searchParams.get(k);
    if (v) claimed.add(v);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Whatever the content type (sendBeacon posts text/plain): if it parses as JSON, check it.
    try {
      const text = await req.clone().text();
      if (text) {
        const body = JSON.parse(text);
        for (const k of ID_KEYS) if (typeof body?.[k] === 'string' && body[k]) claimed.add(body[k]);
      }
    } catch {}
  }
  if (claimed.size === 0) return NextResponse.next();

  const uid = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ error: 'Connecte-toi pour continuer.' }, { status: 401 });
  for (const c of Array.from(claimed)) {
    if (c !== uid) return NextResponse.json({ error: 'Session invalide, reconnecte-toi.' }, { status: 403 });
  }
  return NextResponse.next();
}
