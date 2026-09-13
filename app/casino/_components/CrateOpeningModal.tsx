'use client';

import { useCallback, useEffect, useState } from 'react';
import { Package, ChevronRight, Zap, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { cosmeticById, RARITY_COLOR, RARITY_LABEL, gameLabel, type Rarity } from '@/lib/casino/cosmetics';
import { crateById, RARITY_ORDER, type CrateOpening } from '@/lib/casino/crates';
import CosmeticPreview from './CosmeticPreview';
import EquipButton from './EquipButton';
import CrateReel from './CrateReel';

const RECAP_ORDER: Rarity[] = ['legendaire', 'epique', 'rare', 'commun'];

/**
 * One crate, one reel. Opening several plays them one after the other, and
 * the run ends on a recap of everything that came out.
 */
export default function CrateOpeningModal({
  openings, onClose,
}: {
  openings: CrateOpening[];
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(0);
  const [spinning, setSpinning] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [recap, setRecap] = useState(false);

  const crate = crateById(openings[0]?.crateId || '');
  const done = revealed >= openings.length;

  const spin = useCallback(() => {
    setSpinning((cur) => (cur === null && revealed < openings.length ? revealed : cur));
  }, [revealed, openings.length]);

  const onReelDone = useCallback(() => {
    setSpinning(null);
    setRevealed((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!auto || done || spinning !== null) return;
    const t = setTimeout(spin, 200);
    return () => clearTimeout(t);
  }, [auto, done, spinning, revealed, spin]);

  if (recap) return <Recap openings={openings} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-[210] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-12 w-12 shrink-0 rounded-2xl border-[3px] border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-4px_0_#D98E00]"><Package className="h-6 w-6 text-brand-bg" strokeWidth={2.5} /></span>
            <div className="min-w-0">
              <div className="font-display text-3xl leading-none truncate text-stroke-sm">{crate?.name || 'Caisse'}</div>
              <div className="text-xs font-bold text-tx-secondary mt-1">
                {openings.length > 1 ? `Caisse ${Math.min(revealed + 1, openings.length)}/${openings.length}` : 'Une pièce'}
              </div>
            </div>
          </div>

          {openings.length > 1 && (
            <button
              onClick={() => { sfx.click(); setAuto((a) => !a); }}
              className={cn(
                'h-12 px-4 rounded-xl border-[3px] border-brand-border flex items-center gap-1.5 font-display text-base focus:outline-none transition-transform active:translate-y-[3px]',
                auto ? 'bg-accent-secondary text-white shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A]' : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              Auto
            </button>
          )}
        </div>

        {spinning !== null ? (
          <div className="mb-5">
            <CrateReel reward={openings[spinning].reward} onDone={onReelDone} />
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border-4 border-dashed border-[#3B4290] bg-brand-inner h-[214px] flex flex-col items-center justify-center gap-2">
            <Package className="h-10 w-10 text-tx-muted" />
            <span className="font-display text-xl text-stroke-sm">
              {done ? 'Toutes les caisses sont ouvertes.' : 'Prêt à ouvrir.'}
            </span>
            {!done && crate && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {RARITY_ORDER.filter((r) => crate.odds[r] > 0).map((r) => (
                  <span key={r} className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-brand-bg text-xs font-black tabular-nums" style={{ color: RARITY_COLOR[r] }}>
                    {RARITY_LABEL[r]} {(crate.odds[r] * 100).toFixed(crate.odds[r] < 0.01 ? 1 : 0)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {done ? (
          <button
            onClick={() => { sfx.click(); setRecap(true); }}
            className="w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]"
          >
            Voir le récap
          </button>
        ) : (
          <button
            onClick={spin}
            disabled={spinning !== null}
            className="w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {spinning !== null ? 'Ça tourne…' : 'Ouvrir'}
            {spinning === null && <ChevronRight className="h-6 w-6" strokeWidth={3} />}
            {openings.length > 1 && (
              <span className="text-sm opacity-70">{revealed}/{openings.length}</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Recap({ openings, onClose }: { openings: CrateOpening[]; onClose: () => void }) {
  const cosmetics = openings.map((o) => o.reward).filter((r) => r.kind === 'cosmetic');
  const coins = openings.reduce((sum, o) => sum + o.coins, 0);
  const byRarity = RECAP_ORDER
    .map((r) => ({ rarity: r, pieces: cosmetics.filter((c) => c.rarity === r) }))
    .filter((g) => g.pieces.length > 0);

  return (
    <div className="fixed inset-0 z-[210] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[22px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200">
        <div className="text-center mb-5">
          <span className="mx-auto mb-3 h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-accent-success flex items-center justify-center shadow-[inset_0_-5px_0_#1E9A55]"><Check className="h-8 w-8 text-brand-bg" strokeWidth={3} /></span>
          <h2 className="font-display text-4xl leading-none">
            {openings.length} caisse{openings.length > 1 ? 's' : ''} ouverte{openings.length > 1 ? 's' : ''}
          </h2>
          <p className="text-sm font-bold text-tx-secondary mt-2">
            {cosmetics.length} nouvelle{cosmetics.length > 1 ? 's' : ''} pièce{cosmetics.length > 1 ? 's' : ''}
            {coins > 0 && ` · +${coins.toLocaleString('en-US')} ₶ de doublons`}
          </p>
        </div>

        {byRarity.map(({ rarity, pieces }) => (
          <div key={rarity} className="mb-4">
            <div className="inline-block px-2 py-0.5 rounded-lg border-2 border-brand-border bg-brand-bg text-xs font-black uppercase tracking-widest mb-2" style={{ color: RARITY_COLOR[rarity] }}>
              {RARITY_LABEL[rarity]} · {pieces.length}
            </div>
            <div className="flex flex-wrap gap-2">
              {pieces.map((r, i) => {
                const cosmetic = r.cosmeticId ? cosmeticById(r.cosmeticId) : undefined;
                if (!cosmetic) return null;
                return (
                  <div
                    key={`${r.cosmeticId}-${i}`}
                    className="w-[108px] rounded-2xl border-[3px] p-2 flex flex-col items-center gap-1.5"
                    style={{ borderColor: RARITY_COLOR[rarity], background: `${RARITY_COLOR[rarity]}10` }}
                  >
                    <CosmeticPreview cosmetic={cosmetic} size={64} />
                    <span className="font-display text-xs leading-tight text-center line-clamp-2">{cosmetic.name}</span>
                    <span className="text-[9px] text-tx-muted">{gameLabel(cosmetic.gameSlug)}</span>
                    <EquipButton cosmetic={cosmetic} size="sm" className="w-full" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {coins > 0 && (
          <div className="rounded-2xl border-[3px] border-brand-border bg-accent-success text-brand-bg px-4 py-3 mb-5 flex items-center justify-between shadow-[inset_0_-5px_0_#1E9A55]">
            <span className="text-sm font-black">Doublons convertis</span>
            <span className="font-display text-2xl tabular-nums">
              +{coins.toLocaleString('en-US')} ₶
            </span>
          </div>
        )}

        {cosmetics.length === 0 && coins === 0 && (
          <p className="text-sm text-tx-secondary text-center mb-5">Rien de neuf cette fois.</p>
        )}

        <button
          onClick={onClose}
          className="w-full h-16 rounded-2xl font-display text-2xl border-4 border-brand-border transition-transform focus:outline-none bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]"
        >
          Terminé
        </button>
      </div>
    </div>
  );
}
