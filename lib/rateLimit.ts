/**
 * Exact rate limits for sign-in, sign-up and room creation, counted in the
 * database (public.auth_attempt_hit): Cloudflare's built-in Workers limiter
 * only counts per data centre and let far more attempts through.
 *
 * A database hiccup lets the request through rather than locking everyone out.
 */

import { supabase } from '@/lib/supabase/server';

/** The caller's IP, as Cloudflare saw it. */
export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

/** Counts one attempt for `key`; false once there were more than `limit` in the window. */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('auth_attempt_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) {
      console.error('Rate limit indisponible:', error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error('Rate limit indisponible:', err);
    return true;
  }
}

/** Forgets the attempts for `key` (after a successful sign-in). */
export async function clearAttempts(key: string): Promise<void> {
  try {
    await supabase.rpc('auth_attempt_clear', { p_key: key });
  } catch {
    // Not worth failing a sign-in over.
  }
}
