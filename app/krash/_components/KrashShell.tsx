'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BarChart3, Briefcase, LifeBuoy, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { isMuted, setMuted, sfx } from '@/lib/casino/sfx';
import { KRASH_REFILL_AMOUNT, KRASH_REFILL_BELOW } from '@/lib/krash/assets';
import { useKrashWallet } from '../_lib/useKrashWallet';
import { claimableCount, useKrashProgression } from '../_lib/useKrashProgression';

const NAV = [
  { href: '/krash', label: 'Marché', icon: BarChart3 },
  { href: '/krash/placements', label: 'Placements', icon: Briefcase },
  { href: '/krash/progression', label: 'Progression', icon: Sparkles },
  { href: '/krash/classement', label: 'Classement', icon: Trophy },
];

function SoundToggle() {
  const [muted, setMutedState] = useState(false);
  useEffect(() => setMutedState(isMuted()), []);
  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
        if (!next) sfx.click();
      }}
      aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
      title={muted ? 'Réactiver le son' : 'Couper le son'}
      className={cn(
        'h-11 w-11 shrink-0 rounded-xl border-2 flex items-center justify-center transition-colors',
        muted ? 'border-brand-border bg-brand-inner text-tx-muted' : 'border-rose-400/60 bg-brand-inner text-rose-300'
      )}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}

/** Low on coins: the daily refill, or why it is not available yet. */
function RefillBanner() {
  const wallet = useKrashWallet();
  if (!wallet.loaded || wallet.balance >= KRASH_REFILL_BELOW) return null;

  const next = wallet.nextRefillAt
    ? new Date(wallet.nextRefillAt).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[20px] border-4 border-accent-primary/70 bg-brand-card p-4 shadow-brutal">
      <LifeBuoy className="h-6 w-6 text-accent-primary shrink-0" />
      <div className="flex-1 min-w-[200px]">
        <div className="font-display font-black">Portefeuille presque vide</div>
        <div className="text-[12px] text-tx-muted">
          {wallet.canRefill
            ? `Récupère ${KRASH_REFILL_AMOUNT.toLocaleString('fr-FR')} ₶ pour repartir. Une fois par jour.`
            : wallet.refillBlocked === 'positions'
              ? 'Retire d’abord tes positions ouvertes : le renflouement n’est possible que les mains vides.'
              : `Prochain renflouement : ${next ?? 'bientôt'}. En attendant : coffre du jour et missions dans Progression.`}
        </div>
      </div>
      {wallet.canRefill && (
        <button
          onClick={() => wallet.refill()}
          className="h-11 px-5 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border font-display font-black tracking-wider"
        >
          RENFLOUER
        </button>
      )}
    </div>
  );
}

/** Header, navigation and the Krash balance shared by every Krash page. */
export default function KrashShell({
  title, children, wide = false, badge,
}: { title?: string; children: ReactNode; wide?: boolean; badge?: number }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const wallet = useKrashWallet();
  const { progression } = useKrashProgression();
  const toCollect = claimableCount(progression);

  const badges: Record<string, number | undefined> = {
    '/krash/placements': badge,
    '/krash/progression': toCollect,
  };

  return (
    <main className="min-h-screen bg-brand-bg text-tx-base px-3 sm:px-5 pt-3 md:pt-5 pb-12">
      <div className={cn('mx-auto', wide ? 'max-w-[1400px]' : 'max-w-5xl')}>
        <header className="flex flex-wrap items-center gap-3 mb-4">
          <Link
            href="/"
            aria-label="Accueil"
            onClick={() => sfx.click()}
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-none">
            <div className="font-display text-3xl font-black tracking-wider text-rose-400 drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]">KRASH</div>
            {title && <div className="text-[11px] font-bold uppercase tracking-widest text-tx-muted mt-1">{title}</div>}
          </div>

          <nav className="order-last w-full md:order-none md:w-auto md:ml-4 grid grid-cols-4 md:flex gap-1.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              const count = badges[href];
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => sfx.click()}
                  className={cn(
                    'relative h-10 px-2 md:px-3 rounded-xl border-2 flex items-center justify-center gap-1.5 font-display font-black text-[10px] md:text-[11px] tracking-wider uppercase transition-colors',
                    active ? 'border-rose-400 text-rose-300 bg-rose-400/10' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                  {!!count && (
                    <span className={cn(
                      'absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full text-white text-[10px] flex items-center justify-center border-2 border-brand-bg',
                      href === '/krash/progression' ? 'bg-fuchsia-500 animate-pulse' : 'bg-rose-500'
                    )}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <SoundToggle />
            <div
              className="h-11 px-4 rounded-xl border-2 border-rose-400/60 bg-brand-inner flex items-center gap-2"
              title="Portefeuille Krash, séparé du casino"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Krash</span>
              <span className="font-display font-black tabular-nums text-accent-primary">
                {wallet.loaded ? wallet.balance.toLocaleString('fr-FR') : '…'} ₶
              </span>
            </div>
          </div>
        </header>

        {!loading && !user ? (
          <div className="max-w-md mx-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-8 shadow-brutal text-center mt-10">
            <div className="font-display text-2xl font-black">Connecte-toi pour trader</div>
            <p className="text-tx-muted text-sm mt-2">
              Krash a son propre portefeuille de FrenlyCoins, séparé du casino. Tu commences avec 1 000 ₶.
            </p>
            <Link
              href="/connexion"
              className="mt-6 inline-flex h-12 px-6 items-center rounded-xl bg-rose-500 text-white font-display font-black tracking-wider border-2 border-brand-border"
            >
              SE CONNECTER
            </Link>
          </div>
        ) : (
          <>
            <RefillBanner />
            {children}
          </>
        )}
      </div>
    </main>
  );
}
