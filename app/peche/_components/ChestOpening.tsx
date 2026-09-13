'use client';

import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { COSMETIC_BY_ID, COSMETIC_SLOTS, RARITIES } from '@/lib/peche/data';
import { fmtBig } from '@/lib/peche/format';
import CosmeticIcon from './CosmeticIcon';

export interface ChestResult { cosmeticId: string; rarity: number; duplicate: boolean; refund: number }

const LOCKS = 4;
/** Padlock n is coloured by the rarity you reach if the chest holds past it. */
const LOCK_COLORS = [RARITIES[0].color, RARITIES[1].color, RARITIES[2].color, RARITIES[3].color];

/**
 * The sunken chest. Every chest has four padlocks; each tap takes one off. A
 * chest that opens after one padlock holds a common piece, after two a rare,
 * after three an epic, after four a legendary — so every lock that holds is a
 * little good news. Several chests open side by side, one tap each or all at
 * once.
 */
export default function ChestOpening({
  packsLeft, onOpen, onEquip, onClose,
}: {
  packsLeft: number;
  onOpen: (count: number) => Promise<{ chests: ChestResult[] } | null>;
  onEquip: (cosmeticId: string) => void;
  onClose: () => void;
}) {
  const [chests, setChests] = useState<(ChestResult & { removed: number; shake: number })[]>([]);
  const [busy, setBusy] = useState(false);

  const start = async (count: number) => {
    if (busy) return;
    setBusy(true);
    const r = await onOpen(count);
    setBusy(false);
    if (!r) return;
    sfx.crateOpen(); vibrate(HAPTIC.MEDIUM);
    setChests(r.chests.map((c) => ({ ...c, removed: 0, shake: 0 })));
  };

  const tap = (i: number) => {
    setChests((prev) => prev.map((c, k) => {
      if (k !== i || c.removed > c.rarity) return c;
      const removed = c.removed + 1;
      if (removed > c.rarity) {
        if (c.rarity >= 2) { sfx.bigWin(); vibrate(HAPTIC.SUCCESS); } else { sfx.win(); vibrate(HAPTIC.SOFT); }
      } else {
        sfx.reveal(); vibrate(HAPTIC.SOFT);
      }
      return { ...c, removed, shake: c.shake + 1 };
    }));
  };

  const tapAll = () => chests.forEach((c, i) => { if (c.removed <= c.rarity) tap(i); });

  const allOpen = chests.length > 0 && chests.every((c) => c.removed > c.rarity);
  const counts = [1, 5, 10].filter((n) => n <= packsLeft);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ background: 'linear-gradient(#0B3A66, #04122E)' }}>
      <style>{`
        @keyframes chShake { 0%,100% { transform: translateX(0) rotate(0) } 25% { transform: translateX(-5px) rotate(-3deg) } 75% { transform: translateX(5px) rotate(3deg) } }
        @keyframes chPop { from { transform: scale(.4) rotateY(90deg); opacity: 0 } to { transform: scale(1) rotateY(0); opacity: 1 } }
        @keyframes chBubble { from { transform: translateY(0); opacity: .8 } to { transform: translateY(-120px); opacity: 0 } }
        @keyframes chLock { from { transform: translateY(0) rotate(0); opacity: 1 } to { transform: translateY(40px) rotate(40deg); opacity: 0 } }
        .ch-shake { animation: chShake .35s ease-in-out; }
        .ch-pop { animation: chPop .45s cubic-bezier(.2,.9,.3,1.2) both; }
        .ch-bubble { animation: chBubble 2.4s ease-in infinite; }
        @media (prefers-reduced-motion: reduce) { .ch-shake, .ch-pop, .ch-bubble { animation: none; } }
      `}</style>

      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} aria-hidden className="ch-bubble absolute bottom-0 rounded-full border-2 border-white/40"
          style={{ left: `${(i * 67) % 100}%`, width: 8 + (i % 3) * 6, height: 8 + (i % 3) * 6, animationDelay: `${(i % 6) * 400}ms` }} />
      ))}

      <button onClick={onClose} aria-label="Fermer" className={cn(BRAWL.dark, 'absolute top-4 right-4 h-12 w-12 z-10')}>
        <X className="h-5 w-5" />
      </button>

      <div className="relative w-full max-w-4xl h-[min(640px,92dvh)] flex flex-col">
        <div className="text-center shrink-0">
          <div className="font-display text-4xl text-stroke">Coffres engloutis</div>
          <p className="text-sm font-bold text-[#C2E4FF] mt-1">
            Chaque clic retire un cadenas. Plus le coffre résiste, meilleure est la pièce :
            <span className="whitespace-nowrap"> 1 {RARITIES[0].label.toLowerCase()} · 2 {RARITIES[1].label.toLowerCase()} · 3 {RARITIES[2].label.toLowerCase()} · 4 {RARITIES[3].label.toLowerCase()}</span>
          </p>
        </div>

        {chests.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <ChestArt locks={LOCKS} removed={0} open={false} />
            <div className="font-display text-2xl">{packsLeft} coffre{packsLeft > 1 ? 's' : ''} à ouvrir</div>
            <div className="flex flex-wrap justify-center gap-2">
              {counts.map((n) => (
                <button key={n} onClick={() => start(n)} disabled={busy} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>
                  {n === 1 ? 'En ouvrir 1' : `En ouvrir ${n}`}
                </button>
              ))}
              {packsLeft > 1 && !counts.includes(Math.min(20, packsLeft)) && (
                <button onClick={() => start(Math.min(20, packsLeft))} disabled={busy} className={cn(BRAWL.green, 'h-14 px-6 text-xl')}>
                  Tout ({Math.min(20, packsLeft)})
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto my-4">
              <div className={cn('grid gap-3', chests.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
                {chests.map((c, i) => {
                  const open = c.removed > c.rarity;
                  const cosmetic = COSMETIC_BY_ID.get(c.cosmeticId);
                  const r = RARITIES[c.rarity];
                  return (
                    <button
                      key={i}
                      // Not disabled once open: a disabled button would swallow the "Équiper" tap inside it.
                      onClick={() => tap(i)}
                      aria-disabled={open}
                      className={cn('relative rounded-[22px] border-4 border-brand-border p-2 flex flex-col items-center justify-center min-h-[210px] transition-colors focus:outline-none',
                        open ? 'bg-brand-card cursor-default' : 'bg-[#0E2A4A] hover:bg-[#123560] cursor-pointer')}
                      style={open ? { boxShadow: `0 0 0 4px ${r.color}, 0 6px 0 #05061A` } : { boxShadow: '0 6px 0 #05061A' }}
                    >
                      {open && cosmetic ? (
                        <div className="ch-pop flex flex-col items-center gap-1 text-center">
                          <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border font-display text-sm text-brand-bg" style={{ background: r.color }}>{r.label}</span>
                          <CosmeticIcon cosmetic={cosmetic} size={chests.length === 1 ? 120 : 76} />
                          <div className="font-display text-base leading-tight">{cosmetic.name}</div>
                          <div className="text-[11px] font-bold text-tx-secondary">{COSMETIC_SLOTS[cosmetic.slot]}</div>
                          {c.duplicate
                            ? <div className="text-xs font-black text-accent-primary">Doublon · +{fmtBig(c.refund)} ₶</div>
                            : <span role="button" onClick={(e) => { e.stopPropagation(); onEquip(cosmetic.id); }} className={cn(BRAWL.green, 'mt-1 h-8 px-3 text-sm')}>Équiper</span>}
                        </div>
                      ) : (
                        <div key={c.shake} className={c.shake ? 'ch-shake' : ''}>
                          <ChestArt locks={LOCKS} removed={c.removed} open={false} small={chests.length > 1} />
                          <div className="mt-1 font-display text-sm text-[#C2E4FF]">Clique !</div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="shrink-0 flex flex-wrap justify-center gap-2">
              {!allOpen && chests.length > 1 && (
                <button onClick={tapAll} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>
                  <Lock className="h-5 w-5" /> Un cadenas partout
                </button>
              )}
              {allOpen && packsLeft > 0 && (
                <button onClick={() => setChests([])} className={cn(BRAWL.yellow, 'h-14 px-6 text-xl')}>Encore ({packsLeft})</button>
              )}
              {allOpen && (
                <button onClick={onClose} className={cn(BRAWL.dark, 'h-14 px-6 text-xl')}>Fermer</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A chest on the sea floor with a row of padlocks, taken off one by one. */
function ChestArt({ locks, removed, open, small }: { locks: number; removed: number; open: boolean; small?: boolean }) {
  const w = small ? 130 : 220;
  return (
    <svg width={w} height={w * 0.8} viewBox="0 0 220 176" aria-hidden="true">
      <ellipse cx="110" cy="166" rx="100" ry="10" fill="#C8B27A" opacity="0.5" />
      <rect x="20" y="70" width="180" height="92" rx="14" fill="#8E4418" stroke="#05061A" strokeWidth="7" />
      <path d={open ? 'M20 70 L40 10 L200 10 L200 70 Z' : 'M20 78 Q 110 8 200 78 Z'} fill="#C2632B" stroke="#05061A" strokeWidth="7" strokeLinejoin="round" />
      <rect x="20" y="96" width="180" height="14" fill="#5A6A7A" stroke="#05061A" strokeWidth="5" />
      {Array.from({ length: locks }, (_, i) => {
        const x = 38 + i * 44;
        const gone = i < removed;
        return (
          <g key={i} style={gone ? { animation: 'chLock .4s ease-in forwards', transformBox: 'fill-box' } : undefined}>
            <path d={`M${x + 6} 112 v-10 a10 10 0 0 1 20 0 v10`} fill="none" stroke="#05061A" strokeWidth="6" />
            <rect x={x} y="110" width="32" height="30" rx="7" fill={LOCK_COLORS[i]} stroke="#05061A" strokeWidth="5" />
            <circle cx={x + 16} cy="124" r="4" fill="#05061A" />
          </g>
        );
      })}
    </svg>
  );
}
