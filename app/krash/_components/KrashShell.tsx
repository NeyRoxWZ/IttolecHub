'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { isMuted, setMuted, sfx } from '@/lib/casino/sfx';
import { useKrashWallet } from '../_lib/useKrashWallet';

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

/**
 * Header shared by every Krash page, laid out like the casino's: back
 * button, title, sound and balance. The market page is the hub (its rail
 * leads everywhere); every other page is one step away from it.
 */
export default function KrashShell({
  title, children, wide = false,
}: { title?: string; children: ReactNode; wide?: boolean; badge?: number }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const wallet = useKrashWallet();
  const isHub = pathname === '/krash';

  return (
    <main className="min-h-screen bg-brand-bg text-tx-base px-3 sm:px-5 pt-3 md:pt-5 pb-12 2xl:pb-4">
      <div className={cn('mx-auto', wide ? 'max-w-[1600px]' : 'max-w-5xl')}>
        <header className="flex flex-wrap items-center gap-3 mb-4">
          <Link
            href={isHub ? '/?mode=solo' : '/krash'}
            aria-label={isHub ? 'Accueil' : 'Retour au marché'}
            onClick={() => sfx.click()}
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-none min-w-0">
            <div className="font-display text-3xl font-black tracking-wider text-rose-400 drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]">KRASH</div>
            {title && <div className="text-[11px] font-bold uppercase tracking-widest text-tx-muted mt-1">{title}</div>}
          </div>

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
        ) : children}
      </div>
    </main>
  );
}
