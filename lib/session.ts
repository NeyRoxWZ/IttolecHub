/**
 * The player's session: a signed cookie set by the server when they sign in
 * (passphrase or Discord), unreadable from JavaScript.
 *
 * Before this, the browser simply kept an account id in localStorage and sent
 * it with every request, so knowing someone's id — shown on every leaderboard —
 * was enough to play as them. Now the id comes from this cookie, and the
 * middleware refuses any request that claims another one.
 *
 * Web Crypto only (no Node APIs), so it runs in the middleware, in API routes,
 * on Vercel and on Cloudflare alike.
 */

export const SESSION_COOKIE = 'itollec_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cachedKey: Promise<CryptoKey> | null = null;
function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET manquant ou trop court');
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }
  return cachedKey;
}

/** A signed token for this account, valid SESSION_MAX_AGE. */
export async function signSession(userId: string): Promise<string> {
  const payload = toB64url(enc.encode(JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload)));
  return `${payload}.${toB64url(sig)}`;
}

/** The account id in a token, or null when it is missing, forged or expired. */
export async function readSession(token?: string | null): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromB64url(payload)));
    if (typeof data?.uid !== 'string' || typeof data?.exp !== 'number') return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data.uid;
  } catch {
    return null;
  }
}

/** A signed, expiring token for any small payload (e.g. a seat in a multiplayer room). */
export async function signPayload(payload: Record<string, unknown>, maxAgeSeconds: number): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body)));
  return `${body}.${toB64url(sig)}`;
}

/** The payload of a token from signPayload, or null when missing, forged or expired. */
export async function readPayload<T extends Record<string, unknown>>(token?: string | null): Promise<T | null> {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), fromB64url(sig) as BufferSource, enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(dec.decode(fromB64url(body)));
    if (typeof data?.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data as T;
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/** The signed-in account behind a request, or null. */
export function sessionUserId(request: Request): Promise<string | null> {
  return readSession(cookieValue(request, SESSION_COOKIE));
}

type CookieJar = { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => unknown } };

export async function setSessionCookie(response: CookieJar, userId: string): Promise<void> {
  response.cookies.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(response: CookieJar): void {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
}
