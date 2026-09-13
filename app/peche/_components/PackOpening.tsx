'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { COSMETIC_BY_ID, COSMETIC_SLOTS, RARITIES } from '@/lib/peche/data';
import { fmtBig } from '@/lib/peche/format';
import CosmeticIcon from './CosmeticIcon';

type Stage = 'sealed' | 'bubbles' | 'silhouette' | 'reveal';

const COSMETIC_RARITY = [RARITIES[0], RARITIES[1], RARITIES[2], RARITIES[3]];

/**
 * Opening a treasure chest, in the style of a football card pack: the chest
 * shakes, bubbles rise in the colour of what is inside, a silhouette shows
 * which slot it is, then the card flips to reveal the piece. The server has
 * already decided; the stages only build the suspense.
 */
export default function PackOpening({
  packsLeft, onOpen, onEquip, onClose,
}: {
  packsLeft: number;
  onOpen: () => Promise<{ cosmeticId: string; duplicate: boolean; refund: number } | null>;
  onEquip: (cosmeticId: string) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>('sealed');
  const [result, setResult] = useState<{ cosmeticId: string; duplicate: boolean; refund: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const cosmetic = result ? COSMETIC_BY_ID.get(result.cosmeticId) : undefined;
  const rarity = cosmetic ? COSMETIC_RARITY[cosmetic.rarity] : null;

  const open = async () => {
    if (busy) return;
    setBusy(true);
    sfx.crateOpen(); vibrate(HAPTIC.MEDIUM);
    const r = await onOpen();
    setBusy(false);
    if (!r) return;
    setResult(r);
    setStage('bubbles');
  };

  useEffect(() => {
    if (stage === 'bubbles') {
      const t = setTimeout(() => { setStage('silhouette'); sfx.tick(); }, 1400);
      return () => clearTimeout(t);
    }
    if (stage === 'silhouette') {
      const t = setTimeout(() => {
        setStage('reveal');
        if ((cosmetic?.rarity ?? 0) >= 2) { sfx.bigWin(); vibrate(HAPTIC.SUCCESS); } else { sfx.win(); }
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [stage, cosmetic]);

  const again = () => { setResult(null); setStage('sealed'); };
  const legendary = (cosmetic?.rarity ?? 0) >= 3;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ background: stage !== 'sealed' && legendary ? 'rgba(20,12,0,0.92)' : 'rgba(5,6,26,0.85)' }}>
      <style>{`
        @keyframes pkShake { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-4deg) } 75% { transform: rotate(4deg) } }
        @keyframes pkBubble { from { transform: translateY(0) scale(.6); opacity: 0 } 20% { opacity: 1 } to { transform: translateY(-340px) scale(1.1); opacity: 0 } }
        @keyframes pkPulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.06) } }
        @keyframes pkFlip { from { transform: rotateY(90deg) scale(.8) } to { transform: rotateY(0) scale(1) } }
        @keyframes pkRays { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        .pk-shake { animation: pkShake .5s ease-in-out infinite; }
        .pk-bubble { animation: pkBubble 1.4s ease-out forwards; }
        .pk-pulse { animation: pkPulse .6s ease-in-out infinite; }
        .pk-flip { animation: pkFlip .45s cubic-bezier(.2,.9,.3,1.2) both; }
        .pk-rays { animation: pkRays 8s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .pk-shake, .pk-bubble, .pk-pulse, .pk-flip, .pk-rays { animation: none; } }
      `}</style>

      <button onClick={onClose} aria-label="Fermer" className={cn(BRAWL.dark, 'absolute top-4 right-4 h-12 w-12')}>
        <X className="h-5 w-5" />
      </button>

      <div className="relative w-full max-w-sm h-[480px] flex flex-col items-center justify-center">
        {stage === 'sealed' && (
          <>
            <button onClick={open} disabled={busy} className="pk-shake focus:outline-none" aria-label="Ouvrir le coffre">
              <svg width="200" height="170" viewBox="0 0 200 170">
                <rect x="20" y="70" width="160" height="90" rx="14" fill="#C2632B" stroke="#05061A" strokeWidth="7" />
                <path d="M20 80 Q 100 10 180 80 Z" fill="#E08A4A" stroke="#05061A" strokeWidth="7" strokeLinejoin="round" />
                <rect x="20" y="100" width="160" height="16" fill="#FFC61A" stroke="#05061A" strokeWidth="6" />
                <rect x="84" y="88" width="32" height="40" rx="6" fill="#FFC61A" stroke="#05061A" strokeWidth="6" />
                <circle cx="100" cy="108" r="5" fill="#05061A" />
              </svg>
            </button>
            <div className="mt-6 font-display text-3xl text-center">Coffre au trésor</div>
            <p className="text-sm font-bold text-tx-secondary">{packsLeft} à ouvrir</p>
            <button onClick={open} disabled={busy || packsLeft <= 0} className={cn(BRAWL.yellow, 'mt-5 h-14 px-8 text-2xl')}>
              {busy ? '···' : 'Ouvrir'}
            </button>
          </>
        )}

        {(stage === 'bubbles' || stage === 'silhouette') && rarity && cosmetic && (
          <div className="relative w-full h-full flex items-center justify-center">
            {Array.from({ length: 22 }, (_, i) => (
              <span
                key={i}
                className="pk-bubble absolute bottom-10 rounded-full border-[3px] border-brand-border"
                style={{
                  left: `${8 + ((i * 37) % 84)}%`, width: 14 + (i % 4) * 6, height: 14 + (i % 4) * 6,
                  background: rarity.color, animationDelay: `${(i % 7) * 120}ms`,
                }}
              />
            ))}
            <div className={cn('relative w-56 h-72 rounded-[22px] border-4 border-brand-border flex flex-col items-center justify-center gap-3', stage === 'silhouette' && 'pk-pulse')}
              style={{ background: '#0E1030', boxShadow: `0 0 0 6px ${rarity.color}, 0 10px 0 #05061A` }}
            >
              {stage === 'silhouette' ? (
                <>
                  <CosmeticIcon cosmetic={cosmetic} size={110} hidden />
                  <span className="font-display text-xl" style={{ color: rarity.color }}>{COSMETIC_SLOTS[cosmetic.slot]}</span>
                </>
              ) : (
                <span className="font-display text-4xl" style={{ color: rarity.color }}>?</span>
              )}
            </div>
          </div>
        )}

        {stage === 'reveal' && rarity && cosmetic && result && (
          <div className="relative flex flex-col items-center">
            {legendary && (
              <div className="pk-rays absolute -top-10 w-[420px] h-[420px] pointer-events-none opacity-60"
                style={{ background: `repeating-conic-gradient(${rarity.color} 0 10deg, transparent 10deg 30deg)`, borderRadius: '50%', maskImage: 'radial-gradient(circle, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)' }}
              />
            )}
            <div className="pk-flip relative w-60 rounded-[22px] border-4 border-brand-border bg-brand-card p-5 flex flex-col items-center gap-2 text-center"
              style={{ boxShadow: `0 0 0 6px ${rarity.color}, 0 10px 0 #05061A` }}
            >
              <span className="px-3 py-0.5 rounded-lg border-2 border-brand-border font-display text-base text-brand-bg" style={{ background: rarity.color }}>
                {rarity.label}
              </span>
              <CosmeticIcon cosmetic={cosmetic} size={130} />
              <div className="font-display text-2xl leading-tight">{cosmetic.name}</div>
              <div className="text-sm font-bold text-tx-secondary">{COSMETIC_SLOTS[cosmetic.slot]}</div>
              {result.duplicate && (
                <div className="text-sm font-black text-accent-primary">Déjà obtenu · +{fmtBig(result.refund)} ₶</div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              {!result.duplicate && (
                <button onClick={() => onEquip(cosmetic.id)} className={cn(BRAWL.green, 'h-12 px-5 text-lg')}>Équiper</button>
              )}
              {packsLeft > 0 ? (
                <button onClick={again} className={cn(BRAWL.yellow, 'h-12 px-5 text-lg')}>Encore un ({packsLeft})</button>
              ) : (
                <button onClick={onClose} className={cn(BRAWL.dark, 'h-12 px-5 text-lg')}>Fermer</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
