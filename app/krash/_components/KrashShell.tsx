'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { isMuted, setMuted, sfx } from '@/lib/casino/sfx';
import { useKrashWallet } from '../_lib/useKrashWallet';
import { useKrashLoadout } from '../_lib/useKrashLoadout';
import KrashCosmeticPreview from './KrashCosmeticPreview';
import KrashPlayerCard from './KrashPlayerCard';

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
 * button, title, sound, emblem and balance. The balance opens the player's own
 * card with their curve, as in the casino.
 */
export default function KrashShell({
  title, children, wide = false,
}: { title?: string; children: ReactNode; wide?: boolean; badge?: number }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const wallet = useKrashWallet();
  const { cosmetics } = useKrashLoadout();
  const [card, setCard] = useState(false);
  const isHub = pathname === '/krash';

  return (
    <main data-krash className="min-h-screen bg-transparent text-tx-base px-3 sm:px-5 pt-3 md:pt-5 pb-12 2xl:pb-4">
      {card && user && <KrashPlayerCard pseudo={user.pseudo} onClose={() => setCard(false)} />}
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
            <div className="font-display text-3xl tracking-wider text-white [-webkit-text-stroke:5px_#14142B] [paint-order:stroke_fill] [text-shadow:0_3px_0_#14142B]">KRASH</div>
            {title && <div className="text-[11px] font-bold uppercase tracking-widest text-tx-muted mt-1">{title}</div>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <SoundToggle />
            <button
              onClick={() => { if (user) { sfx.click(); setCard(true); } }}
              className="h-11 pl-2 pr-4 rounded-xl border-2 border-rose-400/60 bg-brand-inner flex items-center gap-2 hover:border-rose-300 transition-colors"
              title="Ma fiche et ma courbe Krash"
            >
              {cosmetics.emblem
                ? <KrashCosmeticPreview cosmetic={cosmetics.emblem} size={30} className="border" />
                : <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted pl-2">Krash</span>}
              <span className="font-display font-black tabular-nums text-accent-primary">
                {wallet.loaded ? wallet.balance.toLocaleString('fr-FR') : '…'} ₶
              </span>
            </button>
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
