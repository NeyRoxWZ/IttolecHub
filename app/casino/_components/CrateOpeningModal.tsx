'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Package, ChevronRight, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { cosmeticById, RARITY_COLOR, RARITY_LABEL, gameLabel, type Rarity } from '@/lib/casino/cosmetics';
import { crateById, type CrateOpening, type CrateReward } from '@/lib/casino/crates';
import CosmeticPreview from './CosmeticPreview';

interface Slot extends CrateReward {
  crate: number;
  /** Position inside its crate, used only for the layout. */
  index: number;
}

const RARITY_ORDER: Rarity[] = ['legendaire', 'epique', 'rare', 'commun'];

/**
 * Rewards are revealed one tap at a time — the count is known up front, so
 * the tension is in what each slot turns out to be. AUTO flips the whole
 * batch, and either way the run ends on a recap of everything obtained.
 */
export default function CrateOpeningModal({
  openings, onClose,
}: {
  openings: CrateOpening[];
  onClose: () => void;
}) {
  const slots: Slot[] = useMemo(
    () => openings.flatMap((o, crate) => o.rewards.map((r, index) => ({ ...r, crate, index }))),
    [openings]
  );

  const [revealed, setRevealed] = useState(0);
  const [auto, setAuto] = useState(false);
  const [recap, setRecap] = useState(false);

  const crate = crateById(openings[0]?.crateId || '');
  const done = revealed >= slots.length;

  const reveal = useCallback(() => {
    setRevealed((r) => {
      if (r >= slots.length) return r;
      const reward = slots[r];
      if (reward.rarity === 'legendaire') { sfx.jackpot(); vibrate(HAPTIC.SUCCESS); }
      else if (reward.rarity === 'epique') { sfx.bigWin(); vibrate(HAPTIC.MEDIUM); }
      else { sfx.coin(); vibrate(HAPTIC.SOFT); }
      return r + 1;
    });
  }, [slots]);

  useEffect(() => {
    if (!auto || done) return;
    const t = setTimeout(reveal, 260);
    return () => clearTimeout(t);
  }, [auto, done, revealed, reveal]);

  // Follow the crate of the *last revealed* item, not the next one: keying
  // off the next slot flipped to the following crate before its final card
  // had been on screen, which is why the last object looked skipped.
  const currentCrate = revealed > 0 ? slots[revealed - 1].crate : 0;
  const crateSlots = slots.filter((s) => s.crate === currentCrate);
  const crateStart = slots.findIndex((s) => s.crate === currentCrate);

  if (recap) {
    return <Recap openings={openings} slots={slots} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 text-accent-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-black text-lg leading-none truncate">{crate?.name || 'Caisse'}</div>
              <div className="text-[11px] text-tx-muted">
                {openings.length > 1 && `Caisse ${currentCrate + 1}/${openings.length} · `}
                {openings[currentCrate]?.count} objets
              </div>
            </div>
          </div>

          <button
            onClick={() => { sfx.click(); setAuto((a) => !a); }}
            className={cn(
              'h-10 px-3 rounded-xl border-2 flex items-center gap-1.5 font-display font-black text-[11px] tracking-wider focus:outline-none transition-colors',
              auto ? 'border-accent-secondary bg-accent-secondary text-white' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            AUTO
          </button>
        </div>

        <p className="text-center text-[11px] text-tx-muted mb-4">
          {openings[currentCrate]?.count === 3 ? 'Trois objets : rien de rare cette fois.'
            : openings[currentCrate]?.count === 4 ? 'Quatre objets : il y a du rare là-dedans.'
            : 'Cinq objets : de l’épique, voire du légendaire.'}
        </p>

        <div className={cn(
          'grid gap-3 justify-center mb-5',
          crateSlots.length === 3 ? 'grid-cols-3' : crateSlots.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-5'
        )}>
          {crateSlots.map((slot, i) => (
            <Card key={`${slot.crate}-${slot.index}`} reward={slot} shown={crateStart + i < revealed} />
          ))}
        </div>

        {done ? (
          <button
            onClick={() => { sfx.click(); setRecap(true); }}
            className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none"
          >
            VOIR LE RÉCAP
          </button>
        ) : (
          <button
            onClick={reveal}
            className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none flex items-center justify-center gap-2"
          >
            OBJET SUIVANT
            <ChevronRight className="h-4 w-4" />
            <span className="text-[11px] font-bold opacity-70">{revealed}/{slots.length}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Card({ reward, shown }: { reward: CrateReward; shown: boolean }) {
  const cosmetic = reward.cosmeticId ? cosmeticById(reward.cosmeticId) : undefined;
  const tone = RARITY_COLOR[reward.rarity];

  return (
    <div
      className={cn(
        'rounded-2xl border-4 p-3 min-h-[168px] flex flex-col items-center justify-center gap-2 transition-all duration-300',
        shown ? 'opacity-100 translate-y-0' : 'opacity-100'
      )}
      style={{
        borderColor: shown ? tone : '#2A2A38',
        background: shown ? `${tone}12` : '#16161F',
      }}
    >
      {!shown ? (
        <>
          <Package className="h-9 w-9 text-tx-muted" />
          <span className="font-display font-black text-lg text-tx-muted">?</span>
        </>
      ) : (
        <>
          {cosmetic ? (
            <CosmeticPreview cosmetic={cosmetic} size={78} />
          ) : (
            <div className="h-[78px] w-[78px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center">
              <Coins className="h-8 w-8" style={{ color: tone }} />
            </div>
          )}
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: tone }}>
            {RARITY_LABEL[reward.rarity]}
          </span>
          <span className="font-display font-black text-[11px] leading-tight text-center">
            {cosmetic?.name || `${(reward.amount || 0).toLocaleString('en-US')} ₶`}
          </span>
          <span className="text-[9px] text-tx-muted text-center leading-tight">
            {reward.duplicate ? 'Doublon → converti en ₶' : cosmetic ? gameLabel(cosmetic.gameSlug) : ''}
          </span>
        </>
      )}
    </div>
  );
}

function Recap({
  openings, slots, onClose,
}: {
  openings: CrateOpening[];
  slots: Slot[];
  onClose: () => void;
}) {
  const cosmetics = slots.filter((s) => s.kind === 'cosmetic');
  const coins = openings.reduce((sum, o) => sum + o.coins, 0);
  const byRarity = RARITY_ORDER.map((r) => ({ rarity: r, pieces: cosmetics.filter((c) => c.rarity === r) }))
    .filter((g) => g.pieces.length > 0);

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="text-center mb-5">
          <Check className="h-7 w-7 text-accent-success mx-auto mb-2" />
          <h2 className="font-display text-2xl font-black leading-none">
            {openings.length} caisse{openings.length > 1 ? 's' : ''} ouverte{openings.length > 1 ? 's' : ''}
          </h2>
          <p className="text-[11px] text-tx-muted mt-1">
            {cosmetics.length} nouvelle{cosmetics.length > 1 ? 's' : ''} pièce{cosmetics.length > 1 ? 's' : ''}
            {coins > 0 && ` · +${coins.toLocaleString('en-US')} ₶ de doublons`}
          </p>
        </div>

        {byRarity.map(({ rarity, pieces }) => (
          <div key={rarity} className="mb-4">
            <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: RARITY_COLOR[rarity] }}>
              {RARITY_LABEL[rarity]} · {pieces.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {pieces.map((s, i) => {
                const cosmetic = s.cosmeticId ? cosmeticById(s.cosmeticId) : undefined;
                if (!cosmetic) return null;
                return (
                  <div
                    key={`${s.crate}-${s.index}-${i}`}
                    className="w-[104px] rounded-xl border-2 p-2 flex flex-col items-center gap-1.5"
                    style={{ borderColor: RARITY_COLOR[rarity], background: `${RARITY_COLOR[rarity]}10` }}
                  >
                    <CosmeticPreview cosmetic={cosmetic} size={64} />
                    <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2">{cosmetic.name}</span>
                    <span className="text-[9px] text-tx-muted">{gameLabel(cosmetic.gameSlug)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {coins > 0 && (
          <div className="rounded-xl border-2 border-accent-success bg-accent-success/10 px-4 py-3 mb-5 flex items-center justify-between">
            <span className="text-sm font-bold text-tx-secondary">Doublons convertis</span>
            <span className="font-display font-black text-lg text-accent-success tabular-nums">
              +{coins.toLocaleString('en-US')} ₶
            </span>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none"
        >
          TERMINÉ
        </button>
      </div>
    </div>
  );
}
