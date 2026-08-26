'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import {
  cosmeticById, CRATE_COSMETICS, RARITY_COLOR, RARITY_LABEL, gameLabel,
  type Cosmetic,
} from '@/lib/casino/cosmetics';
import type { CrateReward } from '@/lib/casino/crates';
import { tempo } from '@/lib/casino/turbo';
import CosmeticPreview from './CosmeticPreview';

const CARD_W = 132;
const GAP = 10;
const STRIDE = CARD_W + GAP;
/** How many decoys roll past before the real one. */
const RUNWAY = 42;

interface Cell {
  cosmetic?: Cosmetic;
  reward?: CrateReward;
  key: string;
}

/**
 * The reel: a strip of possible pieces scrolls past a marker, decelerates and
 * comes to rest on the one the server already chose. The decoys are only
 * decoration — the outcome was decided before the animation started, and the
 * strip is built around it.
 */
export default function CrateReel({
  reward, onDone,
}: {
  reward: CrateReward;
  /** Fired once the reel has settled. */
  onDone: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  // The strip: decoys, then the real reward, then a few more so the marker
  // never sits at the very end of the track.
  const cellsRef = useRef<Cell[]>();
  if (!cellsRef.current) {
    const pool = CRATE_COSMETICS;
    const cells: Cell[] = [];
    for (let i = 0; i < RUNWAY; i++) {
      cells.push({ cosmetic: pool[Math.floor(Math.random() * pool.length)], key: `d${i}` });
    }
    cells.push({
      cosmetic: reward.cosmeticId ? cosmeticById(reward.cosmeticId) : undefined,
      reward,
      key: 'target',
    });
    for (let i = 0; i < 8; i++) {
      cells.push({ cosmetic: pool[Math.floor(Math.random() * pool.length)], key: `t${i}` });
    }
    cellsRef.current = cells;
  }
  const cells = cellsRef.current;

  useEffect(() => {
    const duration = tempo(3400);
    const target = RUNWAY * STRIDE;
    const start = performance.now();
    let raf = 0;

    sfx.crateOpen();
    vibrate(HAPTIC.MEDIUM);

    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Strong ease-out: fast at first, crawling at the end like a real reel.
      const eased = 1 - Math.pow(1 - t, 4);
      const x = target * eased;
      setOffset(x);

      // One tick per card that passes the marker.
      const passed = Math.floor(x / STRIDE);
      if (passed > tickRef.current) {
        tickRef.current = passed;
        sfx.reelTick(t);
      }

      if (t < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        setSettled(true);
        sfx.reelStop(reward.rarity);
        vibrate(reward.rarity === 'legendaire' ? HAPTIC.SUCCESS : HAPTIC.SOFT);
        window.setTimeout(onDone, tempo(900));
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reward, onDone]);

  const tone = RARITY_COLOR[reward.rarity];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-4 border-brand-border bg-brand-inner py-4">
      {/* The marker the strip settles under. */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 z-20 pointer-events-none flex flex-col justify-between items-center py-1">
        <span className="w-0 h-0" style={{ borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: `12px solid ${settled ? tone : '#FFD000'}` }} />
        <span className="w-0 h-0" style={{ borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderBottom: `12px solid ${settled ? tone : '#FFD000'}` }} />
      </div>
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[136px] z-10 pointer-events-none rounded-xl transition-colors duration-300"
        style={{ boxShadow: settled ? `0 0 0 3px ${tone}, 0 0 26px ${tone}88` : '0 0 0 2px rgba(255,208,0,0.35)' }}
      />

      {/* Fades so the strip appears to come from and go into nothing. */}
      <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-brand-inner to-transparent" />
      <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-brand-inner to-transparent" />

      <div className="relative h-[150px]">
        <div
          ref={trackRef}
          className="absolute top-0 left-1/2 flex gap-[10px]"
          style={{ transform: `translateX(${-offset - CARD_W / 2}px)` }}
        >
          {cells.map((cell, i) => {
            const rarity = cell.reward?.rarity ?? cell.cosmetic?.rarity ?? 'commun';
            const cellTone = RARITY_COLOR[rarity];
            const isTarget = cell.key === 'target';
            return (
              <div
                key={cell.key + i}
                className={cn(
                  'shrink-0 rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2',
                  settled && isTarget && 'scale-105'
                )}
                style={{
                  width: CARD_W,
                  height: 150,
                  borderColor: cellTone,
                  background: `${cellTone}12`,
                  transition: 'transform 260ms cubic-bezier(0.2, 1.4, 0.4, 1)',
                }}
              >
                {cell.cosmetic ? (
                  <CosmeticPreview cosmetic={cell.cosmetic} size={72} />
                ) : (
                  <div className="h-[72px] w-[72px] rounded-xl border-2 border-brand-border bg-brand-card flex items-center justify-center">
                    <Coins className="h-8 w-8" style={{ color: cellTone }} />
                  </div>
                )}
                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: cellTone }}>
                  {RARITY_LABEL[rarity]}
                </span>
                <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2 px-1">
                  {cell.cosmetic?.name || `${(cell.reward?.amount || 0).toLocaleString('en-US')} ₶`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={cn('mt-3 text-center transition-opacity duration-300', settled ? 'opacity-100' : 'opacity-0')}>
        <div className="font-display font-black text-sm" style={{ color: tone }}>
          {reward.cosmeticId ? cosmeticById(reward.cosmeticId)?.name : `${(reward.amount || 0).toLocaleString('en-US')} ₶`}
        </div>
        <div className="text-[11px] text-tx-muted">
          {reward.duplicate
            ? 'Doublon → converti en ₶'
            : reward.cosmeticId
              ? gameLabel(cosmeticById(reward.cosmeticId)?.gameSlug || '')
              : ''}
        </div>
      </div>
    </div>
  );
}
