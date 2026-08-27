'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, Flame, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { tempo } from '@/lib/casino/turbo';
import {
  sandboxSpin, applySpin, sandboxStreakBonus, SANDBOX_BET,
  SANDBOX_XP_PER_LEVEL, type SandboxState, type SandboxSpin,
} from '@/lib/casino/sandbox';
import * as Art from './CasinoArt';

const ART: Record<string, (p: { size?: number }) => JSX.Element> = {
  cherry: Art.ArtCherry, bell: Art.ArtBell, star: Art.ArtStar,
  diamond: Art.ArtDiamond, lemon: Art.ArtLemon, seven: Art.ArtSeven,
};

const SYMBOLS = Object.keys(ART);

/**
 * A real slot machine, wired to play money.
 *
 * The tour used to describe the reels, the streak and the near miss in prose.
 * Here the player pulls the handle and watches all three happen — and no bet
 * ever reaches the server, so nothing can be won or lost.
 */
export default function SandboxSlots({
  state, onSpin, highlight,
}: {
  state: SandboxState;
  onSpin: (next: SandboxState, spin: SandboxSpin) => void;
  /** Which part of the machine the current step is talking about. */
  highlight?: 'reels' | 'streak' | 'level' | null;
}) {
  const [reels, setReels] = useState<string[]>(['cherry', 'bell', 'star']);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SandboxSpin | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    sfx.bet();
    vibrate(HAPTIC.MEDIUM);

    const outcome = sandboxSpin(state.bets);
    const start = performance.now();
    const duration = tempo(1100);

    const tick = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        setReels(outcome.symbols);
        setSpinning(false);
        setResult(outcome);
        if (outcome.won) { sfx.win(); vibrate(HAPTIC.SUCCESS); }
        else { sfx.lose(); vibrate(HAPTIC.ERROR); }
        onSpin(applySpin(state, outcome), outcome);
        return;
      }
      // Reels settle left to right, like the real one.
      setReels((prev) => prev.map((current, i) => (
        t > 0.4 + i * 0.2 ? outcome.symbols[i] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      )));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const bonus = sandboxStreakBonus(state.streak);

  return (
    <div className="rounded-2xl border-4 border-brand-border bg-brand-inner p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-accent-primary" />
          <span className="font-display font-black text-lg tabular-nums">
            {state.balance.toLocaleString('en-US')}
          </span>
          <span className="text-tx-secondary font-bold text-xs">₶ de démo</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'h-7 px-2 rounded-lg border-2 flex items-center gap-1',
              highlight === 'streak' && 'ring-2 ring-accent-primary',
              state.streak > 0 ? 'border-accent-secondary bg-accent-secondary/10' : 'border-brand-border'
            )}
          >
            <Flame className={cn('h-3 w-3', state.streak > 0 ? 'text-accent-secondary' : 'text-tx-muted')} />
            <span className="font-display font-black text-[11px] tabular-nums">{state.streak}</span>
            {bonus > 0 && (
              <span className="text-[10px] font-black text-accent-success">+{Math.round(bonus * 100)}%</span>
            )}
          </div>

          <div
            className={cn(
              'h-7 px-2 rounded-lg border-2 border-brand-border flex items-center gap-1.5',
              highlight === 'level' && 'ring-2 ring-accent-primary'
            )}
          >
            <span className="text-[9px] font-black tracking-widest text-tx-muted">NIV {state.level}</span>
            <span className="w-10 h-1.5 rounded-full bg-brand-bg border border-brand-border overflow-hidden block">
              <span
                className="block h-full bg-accent-primary transition-[width] duration-500"
                style={{ width: `${(state.xp / SANDBOX_XP_PER_LEVEL) * 100}%` }}
              />
            </span>
          </div>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border-4 border-brand-border p-4 mb-3',
          highlight === 'reels' && 'ring-2 ring-accent-primary'
        )}
        style={{ background: 'linear-gradient(180deg, #2A1B3D 0%, #1A1028 100%)' }}
      >
        <div className="flex justify-center gap-3">
          {reels.map((symbol, i) => {
            const Piece = ART[symbol] || Art.ArtCherry;
            return (
              <div
                key={i}
                className={cn(
                  'h-[86px] w-[70px] rounded-lg border-2 bg-brand-card flex items-center justify-center',
                  result?.won ? 'border-accent-success' : 'border-brand-border',
                  spinning && 'blur-[1px]'
                )}
              >
                <Piece size={46} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-9 flex items-center justify-center mb-3">
        {result && (
          <span
            className={cn(
              'px-3 py-1.5 rounded-lg border-2 font-display font-black text-xs',
              result.won
                ? 'border-accent-success text-accent-success bg-accent-success/15'
                : 'border-accent-primary text-accent-primary bg-accent-primary/15'
            )}
          >
            {result.won
              ? `×${result.multiplier} — +${result.payout.toLocaleString('en-US')} ₶`
              : 'À un symbole près !'}
          </span>
        )}
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none disabled:opacity-60 flex items-center justify-center gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {spinning ? 'ÇA TOURNE…' : `LANCER · ${SANDBOX_BET} ₶`}
      </button>

      <p className="text-[10px] text-tx-muted text-center mt-2">
        Table d&apos;essai : rien n&apos;est débité, rien n&apos;est gagné pour de vrai.
      </p>
    </div>
  );
}
