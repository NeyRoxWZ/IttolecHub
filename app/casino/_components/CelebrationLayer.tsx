'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Crown, Gem, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import {
  peekCelebration, dismissCelebration, subscribeCelebrations, type Celebration,
} from '@/lib/casino/celebrate';
import Confetti from './Confetti';

/**
 * Full-screen moment for the things that deserve one. Mounted once per casino
 * page; it reads a shared queue so any code path can fire one.
 */
export default function CelebrationLayer() {
  const event = useSyncExternalStore(subscribeCelebrations, peekCelebration, () => null);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!event) return;
    setBurst((b) => b + 1);
    vibrate(HAPTIC.SUCCESS);
    if (event.kind === 'jackpot') sfx.jackpot();
    else sfx.bigWin();
  }, [event]);

  if (!event) return null;

  // A pass tier must not interrupt a run: it slides in from the top and
  // leaves on its own. Levels and jackpots keep the full stop.
  if (event.kind === 'pass_tier') return <TierBanner tiers={event.tiers} />;

  return (
    <div
      className="fixed inset-0 z-[300] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={dismissCelebration}
    >
      <Confetti trigger={burst} intensity="huge" />
      <Panel event={event} />
    </div>
  );
}

/** Non-blocking: the page underneath stays fully playable. */
function TierBanner({ tiers }: { tiers: number[] }) {
  useEffect(() => {
    const t = setTimeout(dismissCelebration, 4500);
    return () => clearTimeout(t);
  }, [tiers]);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[300] px-3 w-full max-w-md pointer-events-none">
      <Link
        href="/casino/pass"
        prefetch
        onClick={dismissCelebration}
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border-4 border-brand-border bg-accent-primary text-brand-bg px-4 py-3 shadow-[inset_0_-6px_0_#D98E00,0_6px_0_#05061A] animate-in slide-in-from-top-4 fade-in duration-300"
      >
        <Crown className="h-7 w-7 text-brand-bg shrink-0" strokeWidth={2.5} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">
            {tiers.length > 1
              ? `Niveau ${tiers[tiers.length - 1]} — ${tiers.length} paliers gagnés`
              : `Niveau ${tiers[0]} gagné`}
          </div>
          <div className="text-xs font-black opacity-80">Récupère ta récompense dans le Frenly Pass.</div>
        </div>
        <span className="px-2 py-1 rounded-lg bg-brand-bg text-white font-display text-sm shrink-0">Voir</span>
      </Link>
    </div>
  );
}

function Panel({ event }: { event: Celebration }) {
  const shell = 'relative w-full max-w-sm rounded-[22px] border-4 border-brand-border bg-brand-card p-8 text-center shadow-[0_8px_0_#05061A] animate-in zoom-in-90 duration-300';

  if (event.kind === 'jackpot') {
    return (
      <div className={shell} onClick={(e) => e.stopPropagation()}>
        <span className="mx-auto mb-4 h-20 w-20 rounded-3xl border-4 border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-6px_0_#2F5BD0,0_5px_0_#05061A]"><Gem className="h-10 w-10 text-white" strokeWidth={2.5} /></span>
        <h2 className="font-display text-6xl leading-none mb-2">Jackpot !</h2>
        <p className="text-sm font-bold text-tx-secondary mb-4">Tu rafles toute la cagnotte commune.</p>
        <div className="font-display text-5xl leading-none text-accent-success tabular-nums mb-6 [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]">
          +{event.amount.toLocaleString('en-US')} ₶
        </div>
        <DismissButton />
      </div>
    );
  }

  return (
    <div className={shell} onClick={(e) => e.stopPropagation()}>
      <span className="mx-auto mb-4 h-20 w-20 rounded-3xl border-4 border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A]"><Crown className="h-10 w-10 text-brand-bg" strokeWidth={2.5} /></span>
      <h2 className="font-display text-3xl leading-tight mb-2">
        {event.tiers.length > 1 ? `${event.tiers.length} paliers débloqués` : `Palier ${event.tiers[0]} débloqué`}
      </h2>
      <p className="text-sm font-bold text-tx-secondary mb-5">
        Récompenses à récupérer dans le Frenly Pass.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
        {event.tiers.slice(0, 12).map((t) => (
          <span key={t} className="h-10 w-10 rounded-xl border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-base flex items-center justify-center">
            {t}
          </span>
        ))}
      </div>
      <DismissButton label="Voir plus tard" />
    </div>
  );
}

function DismissButton({ label = 'Continuer' }: { label?: string }) {
  return (
    <button
      onClick={dismissCelebration}
      className="w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none flex items-center justify-center gap-2 bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]"
    >
      <Sparkles className="h-6 w-6" strokeWidth={2.5} />
      {label}
    </button>
  );
}
