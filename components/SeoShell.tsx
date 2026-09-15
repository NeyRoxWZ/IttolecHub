import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';

export const SEO_BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-brand-border font-display tracking-wide transition-transform active:translate-y-[3px] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-primary';
export const SEO_BTN_YELLOW = `${SEO_BTN} bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]`;
export const SEO_BTN_DARK = `${SEO_BTN} bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]`;

/**
 * The frame of the public game pages: logo, links between the sections,
 * breadcrumb, and a footer. Server-rendered, so everything is in the HTML
 * search engines receive.
 */
export default function SeoShell({ crumbs, children }: { crumbs: { label: string; href?: string }[]; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col text-tx-base">
      <header className="px-4 sm:px-6 pt-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 justify-between">
          <Link href="/" aria-label="Accueil IttolecHub">
            <Image src="/logo-site.png" alt="IttolecHub" width={640} height={333} className="h-12 md:h-14 w-auto" priority />
          </Link>
          <nav aria-label="Sections" className="flex flex-wrap gap-2">
            <Link href="/jeux-multijoueur" className={`${SEO_BTN_DARK} h-11 px-3 text-base`}>Jeux multijoueur</Link>
            <Link href="/jeux-solo" className={`${SEO_BTN_DARK} h-11 px-3 text-base`}>Jeux solo</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <nav aria-label="Fil d’Ariane" className="mb-4">
            <ol className="flex flex-wrap items-center gap-1 text-xs font-black text-tx-secondary">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {c.href ? <Link href={c.href} className="hover:text-white underline-offset-2 hover:underline">{c.label}</Link> : <span className="text-tx-base">{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          {children}
        </div>
      </main>

      <footer className="px-6 pb-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-black tracking-widest uppercase text-tx-secondary">
          <Link href="/" className="hover:text-white">Accueil</Link>
          <Link href="/jeux-multijoueur" className="hover:text-white">Jeux multijoueur</Link>
          <Link href="/jeux-solo" className="hover:text-white">Jeux solo</Link>
          <Link href="/patch-notes" className="hover:text-white">Patch notes</Link>
          <Link href="/conditions" className="hover:text-white">Conditions</Link>
          <Link href="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link>
        </div>
      </footer>
    </div>
  );
}

/** A frequently asked question block, visible on the page (the FAQ structured data must match it). */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-3xl mb-3">Questions fréquentes</h2>
      <div className="space-y-2">
        {items.map((f) => (
          <details key={f.q} className="rounded-2xl border-[3px] border-brand-border bg-brand-card px-4 py-3 open:bg-brand-inner">
            <summary className="cursor-pointer font-display text-lg">{f.q}</summary>
            <p className="mt-2 text-sm font-bold text-tx-secondary leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
