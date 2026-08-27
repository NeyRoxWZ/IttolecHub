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
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="h-5 w-5 text-accent-primary shrink-0" />
            <div className="min-w-0">
              <div className="font-display font-black text-lg leading-none truncate">{crate?.name || 'Caisse'}</div>
              <div className="text-[11px] text-tx-muted">
                {openings.length > 1 ? `Caisse ${Math.min(revealed + 1, openings.length)}/${openings.length}` : 'Une pièce'}
              </div>
            </div>
          </div>

          {openings.length > 1 && (
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
          )}
        </div>

        {spinning !== null ? (
          <div className="mb-5">
            <CrateReel reward={openings[spinning].reward} onDone={onReelDone} />
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border-4 border-dashed border-brand-border bg-brand-inner h-[214px] flex flex-col items-center justify-center gap-2">
            <Package className="h-10 w-10 text-tx-muted" />
            <span className="text-sm text-tx-secondary font-bold">
              {done ? 'Toutes les caisses sont ouvertes.' : 'Prêt à ouvrir.'}
            </span>
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
          <button
            onClick={() => { sfx.click(); setRecap(true); }}
            className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none"
          >
            VOIR LE RÉCAP
          </button>
        ) : (
          <button
            onClick={spin}
            disabled={spinning !== null}
            className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {spinning !== null ? 'ÇA TOURNE…' : 'OUVRIR'}
            {spinning === null && <ChevronRight className="h-4 w-4" />}
            {openings.length > 1 && (
              <span className="text-[11px] font-bold opacity-70">{revealed}/{openings.length}</span>
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
              {pieces.map((r, i) => {
                const cosmetic = r.cosmeticId ? cosmeticById(r.cosmeticId) : undefined;
                if (!cosmetic) return null;
                return (
                  <div
                    key={`${r.cosmeticId}-${i}`}
                    className="w-[104px] rounded-xl border-2 p-2 flex flex-col items-center gap-1.5"
                    style={{ borderColor: RARITY_COLOR[rarity], background: `${RARITY_COLOR[rarity]}10` }}
                  >
                    <CosmeticPreview cosmetic={cosmetic} size={64} />
                    <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2">{cosmetic.name}</span>
                    <span className="text-[9px] text-tx-muted">{gameLabel(cosmetic.gameSlug)}</span>
                    <EquipButton cosmetic={cosmetic} size="sm" className="w-full" />
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

        {cosmetics.length === 0 && coins === 0 && (
          <p className="text-sm text-tx-secondary text-center mb-5">Rien de neuf cette fois.</p>
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
