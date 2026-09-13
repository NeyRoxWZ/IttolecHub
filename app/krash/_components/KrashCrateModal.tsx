'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Coins, Package, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { tempo } from '@/lib/casino/turbo';
import {
  KRASH_CRATE_COSMETICS, KRASH_SLOT_LABEL, RARITY_COLOR, RARITY_LABEL, krashCosmeticById,
  type KrashCosmetic, type Rarity,
} from '@/lib/krash/cosmetics';
import { RARITY_ORDER, krashCrateById, type CrateOpening, type CrateReward } from '@/lib/krash/crates';
import KrashCosmeticPreview from './KrashCosmeticPreview';
import KrashEquipButton from './KrashEquipButton';

const CARD_W = 132;
const GAP = 10;
const STRIDE = CARD_W + GAP;
const RUNWAY = 96;
const RECAP_ORDER: Rarity[] = ['legendaire', 'epique', 'rare', 'commun'];

interface Cell { cosmetic?: KrashCosmetic; reward?: CrateReward; key: string }

/** The casino's crate reel, on Krash cosmetics: the outcome is decided, the strip is built around it. */
function Reel({ reward, onDone }: { reward: CrateReward; onDone: () => void }) {
  const [offset, setOffset] = useState(0);
  const [settled, setSettled] = useState(false);
  const tickRef = useRef(0);
  const cellsRef = useRef<Cell[]>();
  if (!cellsRef.current) {
    const pool = KRASH_CRATE_COSMETICS;
    const cells: Cell[] = [];
    for (let i = 0; i < RUNWAY; i++) cells.push({ cosmetic: pool[Math.floor(Math.random() * pool.length)], key: `d${i}` });
    cells.push({ cosmetic: reward.cosmeticId ? krashCosmeticById(reward.cosmeticId) : undefined, reward, key: 'target' });
    for (let i = 0; i < 8; i++) cells.push({ cosmetic: pool[Math.floor(Math.random() * pool.length)], key: `t${i}` });
    cellsRef.current = cells;
  }
  const cells = cellsRef.current;

  useEffect(() => {
    const duration = tempo(5200);
    const target = RUNWAY * STRIDE;
    const start = performance.now();
    let raf = 0;
    sfx.crateOpen();
    vibrate(HAPTIC.MEDIUM);
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const x = target * (1 - Math.pow(1 - t, 5));
      setOffset(x);
      const passed = Math.floor(x / STRIDE);
      if (passed > tickRef.current) { tickRef.current = passed; sfx.reelTick(t); }
      if (t < 1) raf = requestAnimationFrame(loop);
      else {
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
  const won = reward.cosmeticId ? krashCosmeticById(reward.cosmeticId) : undefined;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-4 border-brand-border bg-brand-inner py-4">
      <div className="absolute left-1/2 top-0 -translate-x-1/2 z-20 pointer-events-none">
        <span className="block w-0 h-0" style={{ borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `14px solid ${settled ? tone : '#FFD000'}` }} />
      </div>
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px z-10 pointer-events-none" style={{ background: settled ? tone : 'rgba(255,208,0,0.5)' }} />
      <div className="absolute inset-y-0 left-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-brand-inner to-transparent" />
      <div className="absolute inset-y-0 right-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-brand-inner to-transparent" />
      <div className="relative h-[150px]">
        <div className="absolute top-0 left-1/2 flex gap-[10px]" style={{ transform: `translateX(${-offset - CARD_W / 2}px)` }}>
          {cells.map((cell, i) => {
            const rarity = cell.reward?.rarity ?? cell.cosmetic?.rarity ?? 'commun';
            const cellTone = RARITY_COLOR[rarity];
            return (
              <div
                key={cell.key + i}
                className={cn('shrink-0 rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2', settled && cell.key === 'target' && 'scale-105')}
                style={{ width: CARD_W, height: 150, borderColor: cellTone, background: `${cellTone}12`, transition: 'transform 260ms cubic-bezier(0.2, 1.4, 0.4, 1)' }}
              >
                {cell.cosmetic ? <KrashCosmeticPreview cosmetic={cell.cosmetic} size={72} /> : (
                  <div className="h-[72px] w-[72px] rounded-xl border-2 border-brand-border bg-brand-card flex items-center justify-center">
                    <Coins className="h-8 w-8" style={{ color: cellTone }} />
                  </div>
                )}
                <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: cellTone }}>{RARITY_LABEL[rarity]}</span>
                <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2 px-1">
                  {cell.cosmetic?.name || `${(cell.reward?.amount || 0).toLocaleString('fr-FR')} ₶`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className={cn('mt-3 flex flex-col items-center gap-2 transition-opacity duration-300', settled ? 'opacity-100' : 'opacity-0')}>
        <div className="text-center">
          <div className="font-display font-black text-sm" style={{ color: tone }}>{won?.name || `${(reward.amount || 0).toLocaleString('fr-FR')} ₶`}</div>
          <div className="text-[11px] text-tx-muted">{reward.duplicate ? 'Rien de neuf à cette rareté → converti en ₶' : won ? KRASH_SLOT_LABEL[won.slot] : ''}</div>
        </div>
        {settled && won && <KrashEquipButton cosmetic={won} size="sm" />}
      </div>
    </div>
  );
}

/** One crate, one reel; several play one after another, then a recap. */
export default function KrashCrateModal({ openings, onClose }: { openings: CrateOpening[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [recap, setRecap] = useState(false);
  const crate = krashCrateById(openings[0]?.crateId || '');
  const done = revealed >= openings.length;

  const spin = useCallback(() => {
    setSpinning((cur) => (cur === null && revealed < openings.length ? revealed : cur));
  }, [revealed, openings.length]);
  const onReelDone = useCallback(() => { setSpinning(null); setRevealed((r) => r + 1); }, []);

  useEffect(() => {
    if (!auto || done || spinning !== null) return;
    const t = setTimeout(spin, 200);
    return () => clearTimeout(t);
  }, [auto, done, spinning, revealed, spin]);

  if (recap) {
    const cosmetics = openings.map((o) => o.reward).filter((r) => r.kind === 'cosmetic');
    const coins = openings.reduce((s, o) => s + o.coins, 0);
    return (
      <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
          <div className="text-center mb-5">
            <Check className="h-7 w-7 text-accent-success mx-auto mb-2" />
            <h2 className="font-display text-2xl font-black leading-none">{openings.length} caisse{openings.length > 1 ? 's' : ''} ouverte{openings.length > 1 ? 's' : ''}</h2>
            <p className="text-[11px] text-tx-muted mt-1">
              {cosmetics.length} nouvelle{cosmetics.length > 1 ? 's' : ''} pièce{cosmetics.length > 1 ? 's' : ''}{coins > 0 && ` · +${coins.toLocaleString('fr-FR')} ₶ de doublons`}
            </p>
          </div>
          {RECAP_ORDER.map((rarity) => {
            const pieces = cosmetics.filter((c) => c.rarity === rarity);
            if (!pieces.length) return null;
            return (
              <div key={rarity} className="mb-4">
                <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: RARITY_COLOR[rarity] }}>{RARITY_LABEL[rarity]} · {pieces.length}</div>
                <div className="flex flex-wrap gap-2">
                  {pieces.map((r, i) => {
                    const c = r.cosmeticId ? krashCosmeticById(r.cosmeticId) : undefined;
                    if (!c) return null;
                    return (
                      <div key={`${r.cosmeticId}-${i}`} className="w-[104px] rounded-xl border-2 p-2 flex flex-col items-center gap-1.5" style={{ borderColor: RARITY_COLOR[rarity], background: `${RARITY_COLOR[rarity]}10` }}>
                        <KrashCosmeticPreview cosmetic={c} size={64} />
                        <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2">{c.name}</span>
                        <KrashEquipButton cosmetic={c} size="sm" className="w-full" />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button onClick={onClose} className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal">TERMINÉ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 text-accent-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-black text-lg leading-none truncate">{crate?.name || 'Caisse'}</div>
              <div className="text-[11px] text-tx-muted">{openings.length > 1 ? `Caisse ${Math.min(revealed + 1, openings.length)}/${openings.length}` : 'Une pièce'}</div>
            </div>
          </div>
          {openings.length > 1 && (
            <button
              onClick={() => { sfx.click(); setAuto((a) => !a); }}
              className={cn('h-10 px-3 rounded-xl border-2 flex items-center gap-1.5 font-display font-black text-[11px] tracking-wider', auto ? 'border-accent-secondary bg-accent-secondary text-white' : 'border-brand-border bg-brand-inner text-tx-secondary')}
            >
              <Zap className="h-3.5 w-3.5" /> AUTO
            </button>
          )}
        </div>
        {spinning !== null ? (
          <div className="mb-5"><Reel reward={openings[spinning].reward} onDone={onReelDone} /></div>
        ) : (
          <div className="mb-5 rounded-2xl border-4 border-dashed border-brand-border bg-brand-inner h-[214px] flex flex-col items-center justify-center gap-2">
            <Package className="h-10 w-10 text-tx-muted" />
            <span className="text-sm text-tx-secondary font-bold">{done ? 'Toutes les caisses sont ouvertes.' : 'Prêt à ouvrir.'}</span>
            {!done && crate && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {RARITY_ORDER.filter((r) => crate.odds[r] > 0).map((r) => (
                  <span key={r} className="text-[10px] font-black tabular-nums" style={{ color: RARITY_COLOR[r] }}>
                    {RARITY_LABEL[r]} {(crate.odds[r] * 100).toFixed(crate.odds[r] < 0.01 ? 1 : 0)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        {done ? (
          <button onClick={() => { sfx.click(); setRecap(true); }} className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal">VOIR LE RÉCAP</button>
        ) : (
          <button onClick={spin} disabled={spinning !== null} className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal flex items-center justify-center gap-2 disabled:opacity-50">
            {spinning !== null ? 'ÇA TOURNE…' : 'OUVRIR'}
            {spinning === null && <ChevronRight className="h-4 w-4" />}
            {openings.length > 1 && <span className="text-[11px] font-bold opacity-70">{revealed}/{openings.length}</span>}
          </button>
        )}
      </div>
    </div>
  );
}
