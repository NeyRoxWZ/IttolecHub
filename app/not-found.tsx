import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass, Home, Dices, Fish } from 'lucide-react';

export const metadata: Metadata = { title: 'Page introuvable' };

const BTN = 'inline-flex items-center justify-center gap-2 rounded-xl border-[3px] border-brand-border font-display tracking-wide transition-transform active:translate-y-[3px] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-primary';

/** Shown for any address that leads nowhere: same look as the site, three ways back in. */
export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-10 text-tx-base">
      <div className="w-full max-w-md text-center bg-brand-card border-4 border-brand-border rounded-[22px] p-8 shadow-[0_8px_0_#05061A]">
        <span className="mx-auto h-20 w-20 rounded-2xl border-[3px] border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-5px_0_#2F5BD0,0_4px_0_#05061A]">
          <Compass className="h-11 w-11 text-white" strokeWidth={2.5} />
        </span>
        <p className="mt-5 font-display text-7xl leading-none text-accent-primary text-stroke">404</p>
        <h1 className="mt-2 font-display text-3xl leading-tight">Cette page n’existe pas</h1>
        <p className="mt-2 text-sm font-bold text-tx-secondary">Le lien est peut-être ancien, ou il y a une faute de frappe dans l’adresse.</p>
        <div className="mt-6 grid gap-2">
          <Link href="/" className={`${BTN} h-14 text-xl bg-accent-primary text-brand-bg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A]`}>
            <Home className="h-5 w-5" /> Retour à l’accueil
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/casino" className={`${BTN} h-12 text-lg bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]`}>
              <Dices className="h-5 w-5" /> Casino
            </Link>
            <Link href="/peche" className={`${BTN} h-12 text-lg bg-[#2B3170] text-white shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A]`}>
              <Fish className="h-5 w-5" /> Pêche
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
