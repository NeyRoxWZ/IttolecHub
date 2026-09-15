import type { Metadata } from 'next';

export const SITE_URL = 'https://itollechub.com';

/**
 * Metadata for a public page: title, description, its canonical address, and
 * the same title and description on the link preview (Discord, WhatsApp, X…),
 * which otherwise repeat the site's default for every page.
 */
export function seoMeta({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · IttolecHub`,
      description,
      url: path,
      siteName: 'IttolecHub',
      locale: 'fr_FR',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'IttolecHub : Casino, Pêche et jeux entre potes' }],
    },
    twitter: { card: 'summary_large_image', title: `${title} · IttolecHub`, description, images: ['/og.png'] },
  };
}
