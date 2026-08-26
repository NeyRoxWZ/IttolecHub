'use client';

import { useEffect, useState } from 'react';
import { Coins, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { cosmeticById, RARITY_COLOR, RARITY_LABEL, gameLabel } from '@/lib/casino/cosmetics';
import type { CrateOpening } from '@/lib/casino/crates';
import { itemById } from '@/lib/casino/shop';
import CosmeticPreview from './CosmeticPreview';

/**
 * Rewards land one at a time. The count is the reveal: three means nothing
 * rare is coming, five means something is, and the player knows that before
 * the first card flips — which is exactly where the tension lives.
 */
export default function CrateOpeningModal({
  opening, onClose,
}: {
  opening: CrateOpening;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= opening.rewards.length) return;
    const t = setTimeout(() => {
      const reward = opening.rewards[revealed];
      if (reward.rarity === 'legendaire') { sfx.jackpot(); vibrate(HAPTIC.SUCCESS); }
      else if (reward.rarity === 'epique') { sfx.bigWin(); vibrate(HAPTIC.MEDIUM); }
      else { sfx.coin(); vibrate(HAPTIC.SOFT); }
      setRevealed((r) => r + 1);
    }, revealed === 0 ? 320 : 420);
    return () => clearTimeout(t);
  }, [revealed, opening.rewards]);

  const done = revealed >= opening.rewards.length;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={done ? onClose : undefined}>
      <div className="w-full max-w-2xl bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <Package className="h-7 w-7 text-accent-primary mx-auto mb-2" />
          <h2 className="font-display text-2xl font-black leading-none">
            {opening.count} objet{opening.count > 1 ? 's' : ''}
          </h2>
          <p className="text-[11px] text-tx-muted mt-1">
            {opening.count === 3 ? 'Rien de rare cette fois.'
              : opening.count === 4 ? 'Il y a du rare là-dedans.'
              : 'Cinq objets — de l’épique, voire du légendaire.'}
          </p>
        </div>

        <div className={cn('grid gap-3 justify-center', opening.count === 3 ? 'grid-cols-3' : opening.count === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5')}>
          {opening.rewards.map((reward, i) => {
            const shown = i < revealed;
            const cosmetic = reward.cosmeticId ? cosmeticById(reward.cosmeticId) : undefined;
            const item = reward.itemId ? itemById(reward.itemId) : undefined;
            const tone = RARITY_COLOR[reward.rarity];

            return (
              <div
                key={i}
                className={cn(
                  'rounded-2xl border-4 p-3 flex flex-col items-center gap-2 transition-all duration-300',
                  shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                )}
                style={{ borderColor: shown ? tone : 'transparent', background: shown ? `${tone}12` : 'transparent' }}
              >
                {shown && (
                  <>
                    {cosmetic ? (
                      <CosmeticPreview cosmetic={cosmetic} size={84} />
                    ) : (
                      <div className="h-[84px] w-[84px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center">
                        <Coins className="h-8 w-8" style={{ color: tone }} />
                      </div>
                    )}

                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: tone }}>
                      {RARITY_LABEL[reward.rarity]}
                    </span>
                    <span className="font-display font-black text-[11px] leading-tight text-center">
                      {cosmetic?.name || item?.name || `${(reward.amount || 0).toLocaleString('fr-FR')} ₶`}
                    </span>
                    {cosmetic && (
                      <span className="text-[9px] text-tx-muted text-center leading-tight">
                        {gameLabel(cosmetic.gameSlug)}
                      </span>
                    )}
                    {reward.duplicate && (
                      <span className="text-[9px] text-tx-muted text-center">Doublon converti en ₶</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {opening.coins > 0 && done && (
          <p className="text-center text-[11px] text-tx-muted mt-4">
            +{opening.coins.toLocaleString('fr-FR')} ₶ crédités pour les doublons.
          </p>
        )}

        <button
          onClick={onClose}
          disabled={!done}
          className="mt-5 w-full h-12 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none disabled:opacity-40"
        >
          {done ? 'TERMINÉ' : '···'}
        </button>
      </div>
    </div>
  );
}
