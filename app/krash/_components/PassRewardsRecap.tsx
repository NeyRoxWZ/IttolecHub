'use client';

import { Check, Coins, Package, Sparkles } from 'lucide-react';
import { RARITY_COLOR, RARITY_LABEL, krashCosmeticById } from '@/lib/krash/cosmetics';
import { krashCrateById } from '@/lib/krash/crates';
import { krashItemById } from '@/lib/krash/shop';
import type { KrashPassReward } from '@/lib/krash/pass';
import KrashCosmeticPreview from './KrashCosmeticPreview';
import KrashEquipButton from './KrashEquipButton';

/**
 * What "tout récupérer" just gave, the way the casino's pass recaps it:
 * cosmetics first with an equip button each, then items and crates, then the
 * coins in one total.
 */
export default function PassRewardsRecap({ rewards, onClose }: { rewards: KrashPassReward[]; onClose: () => void }) {
  const cosmetics = rewards.map((r) => (r.kind === 'cosmetic' && r.cosmeticId ? krashCosmeticById(r.cosmeticId) : undefined)).filter((c): c is NonNullable<typeof c> => !!c);
  const items = rewards.filter((r) => r.kind === 'item' && r.itemId);
  const coins = rewards.filter((r) => r.kind === 'coins').reduce((s, r) => s + (r.amount ?? 0), 0);

  const counts = new Map<string, number>();
  for (const r of items) counts.set(r.itemId!, (counts.get(r.itemId!) ?? 0) + 1);

  return (
    <div className="fixed inset-0 z-[230] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <Check className="h-7 w-7 text-accent-success mx-auto mb-2" />
          <h2 className="font-display text-2xl font-black leading-none">{rewards.length} récompense{rewards.length > 1 ? 's' : ''} récupérée{rewards.length > 1 ? 's' : ''}</h2>
          <p className="text-[11px] text-tx-muted mt-1">Les cosmétiques sont dans ton inventaire, les objets aussi.</p>
        </div>

        {cosmetics.length > 0 && (
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-fuchsia-400" /> Cosmétiques · {cosmetics.length}</div>
            <div className="flex flex-wrap gap-2">
              {cosmetics.map((c) => (
                <div key={c.id} className="w-[112px] rounded-xl border-2 p-2 flex flex-col items-center gap-1.5" style={{ borderColor: RARITY_COLOR[c.rarity], background: `${RARITY_COLOR[c.rarity]}10` }}>
                  <KrashCosmeticPreview cosmetic={c} size={68} />
                  <span className="font-display font-black text-[10px] leading-tight text-center line-clamp-2">{c.name}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: RARITY_COLOR[c.rarity] }}>{RARITY_LABEL[c.rarity]}</span>
                  <KrashEquipButton cosmetic={c} size="sm" className="w-full" />
                </div>
              ))}
            </div>
          </div>
        )}

        {counts.size > 0 && (
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-sky-300" /> Objets et caisses</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from(counts.entries()).map(([id, n]) => {
                const item = krashItemById(id);
                const crate = krashCrateById(id);
                return (
                  <div key={id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5 flex items-center gap-2">
                    <Package className="h-5 w-5 shrink-0 text-tx-secondary" />
                    <span className="font-bold text-[13px] flex-1 truncate">{item?.name ?? crate?.name ?? id}</span>
                    <span className="text-[12px] font-black text-accent-primary">×{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {coins > 0 && (
          <div className="rounded-xl border-2 border-accent-success bg-accent-success/10 px-4 py-3 mb-5 flex items-center justify-between">
            <span className="text-sm font-bold text-tx-secondary flex items-center gap-2"><Coins className="h-4 w-4 text-accent-primary" /> FrenlyCoins</span>
            <span className="font-display font-black text-lg text-accent-success tabular-nums">+{coins.toLocaleString('fr-FR')} ₶</span>
          </div>
        )}

        <button onClick={onClose} className="w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal">
          SUPER
        </button>
      </div>
    </div>
  );
}
