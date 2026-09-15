import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import SeoShell, { Faq, SEO_BTN_YELLOW } from '@/components/SeoShell';
import JsonLd from '@/components/JsonLd';
import { MULTIPLAYER_GAMES } from '@/lib/seo/multiplayerGames';
import { SITE_URL, seoMeta } from '@/lib/seo';

export const metadata = seoMeta({
  title: 'Jeux multijoueur gratuits en ligne entre amis',
  description: 'Undercover, blind test, Petit Bac, jeux de dessin, quiz drapeaux… 18 jeux multijoueur gratuits à jouer entre amis dans le navigateur, sans téléchargement, sur PC et téléphone.',
  path: '/jeux-multijoueur',
});

const FAQ = [
  { q: 'Comment jouer avec mes amis ?', a: 'Sur l’accueil, choisis un pseudo et crée une salle. Envoie le code de la salle (ou le QR code) à tes amis : ils le saisissent et vous jouez ensemble, chacun sur son appareil.' },
  { q: 'Les jeux sont-ils gratuits ?', a: 'Oui, tous les jeux multijoueur d’IttolecHub sont gratuits, sans téléchargement ni abonnement.' },
  { q: 'Ça marche sur téléphone ?', a: 'Oui. Les jeux fonctionnent dans le navigateur, sur ordinateur, tablette et téléphone, et chacun peut jouer sur un appareil différent.' },
  { q: 'Faut-il créer un compte ?', a: 'Non, un pseudo suffit. Un compte gratuit permet de garder ton pseudo et tes badges.' },
];

export default function MultiplayerHubPage() {
  return (
    <SeoShell crumbs={[{ label: 'Accueil', href: '/' }, { label: 'Jeux multijoueur' }]}>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Jeux multijoueur IttolecHub',
            itemListElement: MULTIPLAYER_GAMES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/jeux-multijoueur/${g.slug}`, name: g.name })),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          },
        ]}
      />

      <section className="rounded-[22px] border-4 border-brand-border bg-brand-card p-6 md:p-8 shadow-[0_8px_0_#05061A]">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-brand-border bg-accent-success shadow-[inset_0_-4px_0_#1E9A55]">
          <Users className="h-6 w-6 text-brand-bg" strokeWidth={2.5} />
        </span>
        <h1 className="mt-3 font-display text-4xl md:text-5xl leading-tight">Jeux multijoueur gratuits entre amis</h1>
        <p className="mt-3 max-w-3xl text-base font-bold text-tx-secondary leading-relaxed">
          Crée une salle, envoie le code et jouez ensemble, chacun sur son téléphone ou son ordinateur. Pas de téléchargement, pas d’abonnement :
          des jeux d’ambiance, de déduction, de dessin et des quiz pour vos soirées, vos appels sur Discord ou la pause.
        </p>
        <Link href="/?mode=multiplayer" className={`${SEO_BTN_YELLOW} mt-5 h-14 px-6 text-xl`}>
          Créer une salle <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-3xl mb-3">Les {MULTIPLAYER_GAMES.length} jeux</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MULTIPLAYER_GAMES.map((g) => (
            <li key={g.slug}>
              <Link href={`/jeux-multijoueur/${g.slug}`} className="group block h-full rounded-2xl border-[3px] border-brand-border bg-brand-card p-4 shadow-[0_5px_0_#05061A] transition-transform hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl leading-tight">{g.name}</h3>
                  <span className="shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner px-2 py-0.5 text-[11px] font-black text-tx-secondary">{g.genre}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-accent-primary">{g.tagline}</p>
                <p className="mt-2 text-sm font-bold text-tx-secondary leading-relaxed line-clamp-3">{g.intro}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-sm font-black text-white group-hover:underline">Voir les règles <ArrowRight className="h-4 w-4" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Faq items={FAQ} />
    </SeoShell>
  );
}
