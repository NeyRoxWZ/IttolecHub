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
      className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
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
        className="pointer-events-auto flex items-center gap-3 rounded-2xl border-4 border-accent-primary bg-brand-card/95 backdrop-blur px-4 py-3 shadow-brutal animate-in slide-in-from-top-4 fade-in duration-300"
      >
        <Crown className="h-6 w-6 text-accent-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-black text-sm leading-tight">
            {tiers.length > 1 ? `${tiers.length} paliers débloqués` : `Palier ${tiers[0]} débloqué`}
          </div>
          <div className="text-[11px] text-tx-muted">Récompense à réclamer dans le Frenly Pass.</div>
        </div>
        <span className="text-[10px] font-black text-accent-primary tracking-widest shrink-0">VOIR</span>
      </Link>
    </div>
  );
}

function Panel({ event }: { event: Celebration }) {
  const shell = 'relative w-full max-w-sm rounded-[28px] border-4 border-brand-border bg-brand-card p-8 text-center shadow-brutal animate-in zoom-in-90 duration-300';

  if (event.kind === 'level') {
    return (
      <div className={shell} onClick={(e) => e.stopPropagation()}>
        <style>{`
          @keyframes levelPop { 0% { transform: scale(0.5) rotate(-8deg); opacity: 0; } 60% { transform: scale(1.12) rotate(2deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
          @keyframes levelRing { 0% { transform: scale(0.7); opacity: .9; } 100% { transform: scale(2.1); opacity: 0; } }
        `}</style>

        <div className="relative h-32 flex items-center justify-center mb-4">
          {[0, 0.35, 0.7].map((d) => (
            <span
              key={d}
              className="absolute rounded-full border-4 border-accent-primary"
              style={{ width: 120, height: 120, animation: `levelRing 1.6s ease-out ${d}s infinite` }}
            />
          ))}
          <div
            className="relative h-28 w-28 rounded-full border-4 border-brand-border bg-accent-primary flex flex-col items-center justify-center"
            style={{ animation: 'levelPop 520ms cubic-bezier(0.2, 1.4, 0.4, 1) both' }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-bg/70">Niveau</span>
            <span className="font-display font-black text-5xl leading-none text-brand-bg tabular-nums">{event.level}</span>
          </div>
        </div>

        <h2 className="font-display text-2xl font-black mb-1">Niveau supérieur</h2>
        <p className="text-sm text-tx-secondary mb-4">
          Le coffre de niveau s&apos;ouvre tout seul.
        </p>

        <div className="rounded-xl border-2 border-accent-success bg-accent-success/10 py-3 mb-5">
          <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Coffre de niveau</div>
          <div className="font-display font-black text-2xl text-accent-success tabular-nums">
            +{event.reward.toLocaleString('fr-FR')} ₶
          </div>
        </div>

        <DismissButton />
      </div>
    );
  }

  if (event.kind === 'jackpot') {
    return (
      <div className={cn(shell, 'border-accent-primary')} onClick={(e) => e.stopPropagation()}>
        <Gem className="h-14 w-14 text-accent-primary mx-auto mb-3" />
        <h2 className="font-display text-3xl font-black text-accent-primary mb-1">JACKPOT</h2>
        <p className="text-sm text-tx-secondary mb-4">Tu rafles toute la cagnotte commune.</p>
        <div className="font-display font-black text-4xl text-accent-success tabular-nums mb-5">
          +{event.amount.toLocaleString('fr-FR')} ₶
        </div>
        <DismissButton />
      </div>
    );
  }

  return (
    <div className={shell} onClick={(e) => e.stopPropagation()}>
      <Crown className="h-12 w-12 text-accent-primary mx-auto mb-3" />
      <h2 className="font-display text-2xl font-black mb-1">
        {event.tiers.length > 1 ? `${event.tiers.length} paliers débloqués` : `Palier ${event.tiers[0]} débloqué`}
      </h2>
      <p className="text-sm text-tx-secondary mb-5">
        Récompenses à récupérer dans le Frenly Pass.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
        {event.tiers.slice(0, 12).map((t) => (
          <span key={t} className="h-8 w-8 rounded-lg border-2 border-accent-primary bg-accent-primary/10 text-accent-primary font-display font-black text-xs flex items-center justify-center">
            {t}
          </span>
        ))}
      </div>
      <DismissButton label="VOIR PLUS TARD" />
    </div>
  );
}

function DismissButton({ label = 'CONTINUER' }: { label?: string }) {
  return (
    <button
      onClick={dismissCelebration}
      className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none flex items-center justify-center gap-2"
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </button>
  );
}
