import type { MetadataRoute } from 'next';

/**
 * Served at /robots.txt. Cloudflare adds its own managed rules (AI crawlers,
 * content signals) on top of this; here: what search engines may visit, and
 * where the sitemap is.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The API, personal pages and games in progress have nothing to index.
      disallow: ['/api/', '/profil', '/room/', '/games/'],
    },
    sitemap: 'https://itollechub.com/sitemap.xml',
    host: 'https://itollechub.com',
  };
}
