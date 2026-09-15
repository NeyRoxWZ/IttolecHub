import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check, Settings2 } from 'lucide-react';
import SeoShell, { Faq, SEO_BTN_YELLOW, SEO_BTN_DARK } from '@/components/SeoShell';
import JsonLd from '@/components/JsonLd';
import { MULTIPLAYER_GAMES, multiplayerGame } from '@/lib/seo/multiplayerGames';
import { SITE_URL, seoMeta } from '@/lib/seo';

export function generateStaticParams() {
  return MULTIPLAYER_GAMES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const game = multiplayerGame((await params).slug);
  if (!game) return {};
  return seoMeta({
    title: game.headline,
    description: `${game.name} : ${game.intro.slice(0, 120).replace(/\s+\S*$/, '')}… Gratuit, en ligne, sans téléchargement, entre amis sur PC et téléphone.`,
    path: `/jeux-multijoueur/${game.slug}`,
  });
}

/** The public page of one multiplayer game: what it is, how to play, its settings, a FAQ. */
export default async function MultiplayerGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const game = multiplayerGame((await params).slug);
  if (!game) notFound();
  const url = `${SITE_URL}/jeux-multijoueur/${game.slug}`;
  const others = MULTIPLAYER_GAMES.filter((g) => g.slug !== game.slug);

  return (
    <SeoShell crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Jeux multijoueur', href: '/jeux-multijoueur' }, { label: game.name }]}>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: game.name,
            url,
            description: game.intro,
            genre: game.genre,
            inLanguage: 'fr',
            playMode: 'MultiPlayer',
            gamePlatform: ['Navigateur web', 'PC', 'Mobile'],
            applicationCategory: 'Game',
            operatingSystem: 'Web',
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
            publisher: { '@type': 'Organization', name: 'IttolecHub', url: SITE_URL },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: 'Jeux multijoueur', item: `${SITE_URL}/jeux-multijoueur` },
              { '@type': 'ListItem', position: 3, name: game.name, item: url },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: game.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]}
      />

      <section className="rounded-[22px] border-4 border-brand-border bg-brand-card p-6 md:p-8 shadow-[0_8px_0_#05061A]">
        <span className="rounded-lg border-2 border-brand-border bg-brand-inner px-2 py-0.5 text-xs font-black text-tx-secondary">{game.genre} · multijoueur</span>
        <h1 className="mt-3 font-display text-4xl md:text-5xl leading-tight">{game.headline}</h1>
        <p className="mt-1 font-display text-xl text-accent-primary">{game.tagline}</p>
        <p className="mt-3 max-w-3xl text-base font-bold text-tx-secondary leading-relaxed">{game.intro}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/?mode=multiplayer" className={`${SEO_BTN_YELLOW} h-14 px-6 text-xl`}>
            Jouer à {game.name} <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/jeux-multijoueur" className={`${SEO_BTN_DARK} h-14 px-5 text-lg`}>Tous les jeux</Link>
        </div>
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border-[3px] border-brand-border bg-brand-card p-5">
          <h2 className="font-display text-2xl mb-3">Comment jouer à {game.name}</h2>
          <ol className="space-y-2">
            {game.steps.map((s, i) => (
              <li key={s} className="flex gap-3 items-start">
                <span className="h-7 w-7 shrink-0 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display flex items-center justify-center">{i + 1}</span>
                <p className="text-sm font-bold text-tx-secondary leading-snug pt-1">{s}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm font-bold text-tx-secondary">
            Pour lancer une partie : crée une salle depuis l’accueil, choisis {game.name} et envoie le code à tes amis.
          </p>
        </section>

        <section className="rounded-2xl border-[3px] border-brand-border bg-brand-card p-5">
          <h2 className="font-display text-2xl mb-3 flex items-center gap-2"><Settings2 className="h-6 w-6 text-accent-primary" /> Réglages de la salle</h2>
          <ul className="space-y-1.5">
            {game.settings.map((s) => (
              <li key={s} className="flex gap-2 items-start text-sm font-bold text-tx-secondary">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-accent-success" strokeWidth={3} /> {s}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Faq items={game.faq} />

      <section className="mt-8">
        <h2 className="font-display text-3xl mb-3">D’autres jeux multijoueur</h2>
        <ul className="flex flex-wrap gap-2">
          {others.map((g) => (
            <li key={g.slug}>
              <Link href={`/jeux-multijoueur/${g.slug}`} className={`${SEO_BTN_DARK} h-11 px-3 text-base`}>{g.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </SeoShell>
  );
}
