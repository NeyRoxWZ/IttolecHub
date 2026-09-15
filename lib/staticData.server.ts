import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Reads a JSON file from /public on the server.
 *
 * On Vercel the game routes read these with fs; a Cloudflare Worker has no
 * filesystem, so since the move RentGuessr, JaugeGuessr and LogoGuessr could
 * not start (404). The file is fetched from the site's own static assets
 * instead (the ASSETS binding, no extra request through the worker), and kept
 * in memory while the worker stays warm.
 */
const cache = new Map<string, Promise<unknown>>();

export function readPublicJson<T>(path: string, request: Request): Promise<T> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T>;

  const load = (async () => {
    const url = new URL(path, request.url);
    let res: Response | undefined;
    try {
      const assets = (getCloudflareContext().env as { ASSETS?: { fetch: (u: URL) => Promise<Response> } }).ASSETS;
      if (assets) res = await assets.fetch(url);
    } catch {
      // Outside the worker (next dev): plain fetch below.
    }
    if (!res || !res.ok) res = await fetch(url);
    if (!res.ok) throw new Error(`Données introuvables : ${path} (${res.status})`);
    return (await res.json()) as T;
  })();

  cache.set(path, load);
  load.catch(() => cache.delete(path));
  return load;
}
