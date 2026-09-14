/**
 * Rate limits for the sign-in routes, on Cloudflare's built-in Workers rate
 * limiter (the AUTH_LIMITER binding in wrangler.jsonc: 10 hits a minute per
 * key). Without it, nothing stopped someone from trying passphrases for an
 * account thousands of times in a row.
 *
 * Outside Cloudflare (`next dev`) the binding does not exist and the check lets
 * everything through, so local development keeps working.
 */

import { getCloudflareContext } from '@opennextjs/cloudflare';

type Limiter = { limit(options: { key: string }): Promise<{ success: boolean }> };

function limiter(): Limiter | null {
  try {
    const env = getCloudflareContext().env as unknown as { AUTH_LIMITER?: Limiter };
    return env.AUTH_LIMITER ?? null;
  } catch {
    return null;
  }
}

/** The caller's IP, as Cloudflare saw it. */
export function clientIp(request: Request): string {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

/** True when every key is still under its limit. Each key counts one hit. */
export async function underLimit(...keys: string[]): Promise<boolean> {
  const l = limiter();
  if (!l) return true;
  for (const key of keys) {
    try {
      const { success } = await l.limit({ key });
      if (!success) return false;
    } catch {
      // A limiter hiccup must not lock everyone out.
    }
  }
  return true;
}
