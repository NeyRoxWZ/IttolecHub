'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, BarChart3, Briefcase, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';

const NAV = [
  { href: '/krash', label: 'Marché', icon: BarChart3 },
  { href: '/krash/placements', label: 'Placements', icon: Briefcase },
  { href: '/krash/classement', label: 'Classement', icon: Trophy },
];

/** Header, navigation and balance shared by every Krash page. */
export default function KrashShell({
  title, children, wide = false, badge,
}: { title?: string; children: ReactNode; wide?: boolean; badge?: number }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { balance, isLoaded } = useCasinoWallet();

  return (
    <main className="min-h-screen bg-brand-bg text-tx-base px-3 sm:px-5 pt-3 md:pt-5 pb-12">
      <div className={cn('mx-auto', wide ? 'max-w-[1400px]' : 'max-w-5xl')}>
        <header className="flex flex-wrap items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Accueil"
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-none">
            <div className="font-display text-3xl font-black tracking-wider text-rose-400 drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]">KRASH</div>
            {title && <div className="text-[11px] font-bold uppercase tracking-widest text-tx-muted mt-1">{title}</div>}
          </div>

          <nav className="order-last w-full sm:order-none sm:w-auto sm:ml-4 grid grid-cols-3 sm:flex gap-1.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative h-10 px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 font-display font-black text-[11px] tracking-wider uppercase transition-colors',
                    active ? 'border-rose-400 text-rose-300 bg-rose-400/10' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {href === '/krash/placements' && !!badge && (
                    <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center border-2 border-brand-bg">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto h-11 px-4 rounded-xl border-2 border-accent-primary/60 bg-brand-inner flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Solde</span>
            <span className="font-display font-black tabular-nums text-accent-primary">
              {isLoaded ? balance.toLocaleString('fr-FR') : '…'} ₶
            </span>
          </div>
        </header>

        {!loading && !user ? (
          <div className="max-w-md mx-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-8 shadow-brutal text-center mt-10">
            <div className="font-display text-2xl font-black">Connecte-toi pour trader</div>
            <p className="text-tx-muted text-sm mt-2">Krash utilise tes FrenlyCoins, les mêmes qu’au casino.</p>
            <Link
              href="/connexion"
              className="mt-6 inline-flex h-12 px-6 items-center rounded-xl bg-rose-500 text-white font-display font-black tracking-wider border-2 border-brand-border"
            >
              SE CONNECTER
            </Link>
          </div>
        ) : children}
      </div>
    </main>
  );
}
