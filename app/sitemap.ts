import type { MetadataRoute } from 'next';
import { CASINO_GAMES } from '@/lib/casino/games';

const SITE = 'https://itollechub.com';

/**
 * The public pages, listed for search engines (served at /sitemap.xml).
 * Personal and one-off pages — profile, rooms, games in progress — are left out.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) => ({
    url: `${SITE}${path}`, lastModified: now, changeFrequency, priority,
  });

  return [
    page('/', 1, 'weekly'),
    page('/casino', 0.9, 'weekly'),
    page('/peche', 0.9, 'weekly'),
    ...CASINO_GAMES.map((g) => page(`/casino/${g.slug}`, 0.7, 'monthly')),
    page('/casino/pass', 0.6, 'monthly'),
    page('/casino/shop', 0.6, 'daily'),
    page('/casino/defi', 0.6, 'daily'),
    page('/casino/leaderboard', 0.5, 'daily'),
    page('/casino/direct', 0.4, 'daily'),
    page('/patch-notes', 0.6, 'weekly'),
    page('/creer-compte', 0.5, 'yearly'),
    page('/connexion', 0.4, 'yearly'),
    page('/conditions', 0.3, 'yearly'),
    page('/confidentialite', 0.3, 'yearly'),
    page('/mentions-legales', 0.3, 'yearly'),
  ];
}
