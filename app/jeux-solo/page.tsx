import Link from 'next/link';
import { ArrowRight, Dices, Fish } from 'lucide-react';
import SeoShell, { Faq, SEO_BTN_YELLOW } from '@/components/SeoShell';
import JsonLd from '@/components/JsonLd';
import { CASINO_GAMES } from '@/lib/casino/games';
import { SITE_URL, seoMeta } from '@/lib/seo';

export const metadata = seoMeta({
  title: 'Jeux solo gratuits en ligne : casino fictif et jeu de pêche',
  description: 'Un casino gratuit en monnaie fictive avec 20 mini-jeux (slots, blackjack, mines, tower, plinko…) et un jeu de pêche avec des centaines d’espèces. Sans argent réel, sans téléchargement.',
  path: '/jeux-solo',
});

const FAQ = [
  { q: 'Le casino utilise-t-il de l’argent réel ?', a: 'Non. On joue avec des FrenlyCoins, une monnaie fictive qui ne s’achète pas et ne se retire pas. Aucun argent réel n’est en jeu.' },
  { q: 'Faut-il un compte pour jouer ?', a: 'Au casino, on peut jouer sans compte avec un solde gardé sur l’appareil. Un compte gratuit sauvegarde la progression et débloque les récompenses quotidiennes, les coffres et les cosmétiques. La Pêche demande un compte, car toute la partie est sauvegardée dessus.' },
  { q: 'Ça marche sur téléphone ?', a: 'Oui, et chaque jeu peut s’installer comme une appli sur l’écran d’accueil.' },
];

export default function SoloHubPage() {
  return (
    <SeoShell crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Jeux solo' }]}>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: 'Casino IttolecHub',
            url: `${SITE_URL}/casino`,
            description: 'Casino gratuit en monnaie fictive avec 20 mini-jeux, pass, coffres, missions et cagnotte.',
            genre: 'Casino en monnaie fictive',
            inLanguage: 'fr', playMode: 'SinglePlayer', applicationCategory: 'Game', operatingSystem: 'Web', isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'VideoGame',
            name: 'Pêche',
            url: `${SITE_URL}/peche`,
            description: 'Jeu de pêche en ligne : des centaines d’espèces, matériel à améliorer, Poissodex, aquarium et Marées.',
            genre: 'Jeu de pêche',
            inLanguage: 'fr', playMode: 'SinglePlayer', applicationCategory: 'Game', operatingSystem: 'Web', isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]}
      />

      <h1 className="font-display text-4xl md:text-5xl leading-tight">Jeux solo gratuits en ligne</h1>
      <p className="mt-3 max-w-3xl text-base font-bold text-tx-secondary leading-relaxed">
        Joue à ton rythme, depuis ton navigateur, sur ordinateur ou téléphone. Deux grands jeux gratuits, sans téléchargement et sans argent réel.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-[22px] border-4 border-brand-border bg-brand-card p-6 shadow-[0_8px_0_#05061A]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-brand-border bg-[#8B3DFF] shadow-[inset_0_-4px_0_#6A22D6]">
            <Dices className="h-6 w-6 text-white" strokeWidth={2.5} />
          </span>
          <h2 className="mt-3 font-display text-3xl leading-tight">Casino gratuit en monnaie fictive</h2>
          <p className="mt-2 text-sm font-bold text-tx-secondary leading-relaxed">
            20 mini-jeux avec des FrenlyCoins : machine à sous, blackjack, roulette, mines, tower, plinko, crash… Monte ton niveau, remplis le pass,
            ouvre des coffres, relève les missions et tente de rafler la cagnotte. Aucun argent réel.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {CASINO_GAMES.map((g) => (
              <li key={g.slug}>
                <Link href={`/casino/${g.slug}`} className="inline-block rounded-lg border-2 border-brand-border bg-brand-inner px-2 py-1 text-xs font-black text-tx-secondary hover:text-white">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/casino" className={`${SEO_BTN_YELLOW} mt-5 h-12 px-5 text-lg`}>
            Jouer au casino <ArrowRight className="h-5 w-5" />
          </Link>
        </section>

        <section className="rounded-[22px] border-4 border-brand-border bg-brand-card p-6 shadow-[0_8px_0_#05061A]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-brand-border bg-accent-info shadow-[inset_0_-4px_0_#2F5BD0]">
            <Fish className="h-6 w-6 text-white" strokeWidth={2.5} />
          </span>
          <h2 className="mt-3 font-display text-3xl leading-tight">Pêche : jeu de pêche en ligne</h2>
          <p className="mt-2 text-sm font-bold text-tx-secondary leading-relaxed">
            Lance ta ligne et ferre au bon moment pour attraper des centaines d’espèces, des plus communes aux légendaires. Améliore ta canne et
            ton bateau, explore de nouveaux coins, remplis ton Poissodex, décore ton aquarium et enchaîne les Grandes Marées. Mode solo ou port public
            avec les autres joueurs.
          </p>
          <Link href="/peche" className={`${SEO_BTN_YELLOW} mt-5 h-12 px-5 text-lg`}>
            Jouer à la Pêche <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
      </div>

      <Faq items={FAQ} />
    </SeoShell>
  );
}
