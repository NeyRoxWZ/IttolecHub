'use client';

import { X, Sparkles, ArrowDown, ArrowUp, ShieldCheck, TrendingUp } from 'lucide-react';
import { PRESTIGE_THRESHOLD, CASINO_STARTING_BALANCE, getPrestigeTitle } from '@/lib/casino/meta';
import { prestigeWinBonus, PRESTIGE_MAX_REWARDED } from '@/lib/casino/progression';
import { prestigeCosmetic, SLOT_LABEL } from '@/lib/casino/cosmetics';
import CosmeticPreview, { cosmeticEffect } from './CosmeticPreview';

/**
 * Prestige wipes the balance, and nothing on screen said so before the click.
 * This spells out what goes, what stays, and exactly what it buys — the
 * exclusive piece and the extra cut on every win.
 */
export default function PrestigeModal({
  balance, prestigeCount, busy, onConfirm, onClose,
}: {
  balance: number;
  prestigeCount: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const next = prestigeCount + 1;
  const nextTitle = getPrestigeTitle(next);
  const cosmetic = prestigeCosmetic(next);
  const currentBonus = prestigeWinBonus(prestigeCount);
  const nextBonus = prestigeWinBonus(next);

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-primary" /> Prestige {next}
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">Irréversible. Lis avant de valider.</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border-2 border-accent-secondary bg-accent-secondary/10 p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown className="h-4 w-4 text-accent-secondary" />
            <span className="font-display font-black text-xs uppercase tracking-widest text-accent-secondary">Ce que tu perds</span>
          </div>
          <p className="text-sm text-tx-secondary leading-snug">
            Ton solde repart de <span className="font-black text-tx-base">{CASINO_STARTING_BALANCE.toLocaleString('en-US')} ₶</span>.
            Tu en as <span className="font-black text-tx-base">{balance.toLocaleString('en-US')} ₶</span> :
            c&apos;est ce que tu abandonnes.
          </p>
        </div>

        {/* The exclusive piece, previewed with the artwork it will actually use. */}
        {cosmetic && (
          <div className="rounded-xl border-2 border-accent-primary bg-accent-primary/10 p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent-primary" />
              <span className="font-display font-black text-xs uppercase tracking-widest text-accent-primary">Cosmétique exclusif</span>
            </div>
            <div className="flex items-center gap-3">
              <CosmeticPreview cosmetic={cosmetic} size={72} />
              <div className="min-w-0">
                <div className="font-display font-black text-sm leading-tight">{cosmetic.name}</div>
                <div className="text-[11px] text-tx-secondary leading-snug">{cosmeticEffect(cosmetic)}</div>
                <div className="text-[10px] text-tx-muted mt-1">
                  {SLOT_LABEL[cosmetic.slot]} · tous les jeux · introuvable en caisse ou au passe
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border-2 border-accent-success bg-accent-success/10 p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-accent-success" />
            <span className="font-display font-black text-xs uppercase tracking-widest text-accent-success">Bonus permanent</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display font-black text-2xl text-accent-success tabular-nums">
              +{(nextBonus * 100).toFixed(1)}%
            </span>
            <span className="text-[11px] text-tx-secondary">
              sur le bénéfice de chaque gain
              {currentBonus > 0 && ` (contre +${(currentBonus * 100).toFixed(1)}% aujourd’hui)`}
            </span>
          </div>
          <p className="text-[10px] text-tx-muted mt-1">
            +0,5% par prestige, jusqu&apos;à +{(PRESTIGE_MAX_REWARDED * 0.5).toFixed(0)}% au prestige {PRESTIGE_MAX_REWARDED}.
          </p>
        </div>

        <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-tx-secondary" />
            <span className="font-display font-black text-xs uppercase tracking-widest text-tx-muted">Le reste</span>
          </div>
          <p className="text-sm text-tx-secondary leading-snug">
            Titre <span className="font-black text-accent-primary">{nextTitle}</span> sous ton pseudo.
            Niveau et XP, succès, cosmétiques, inventaire, Frenly Pass et records sont conservés :
            seul le solde est remis à zéro.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors focus:outline-none"
          >
            ANNULER
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || balance < PRESTIGE_THRESHOLD}
            className="flex-[1.4] py-3 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none disabled:opacity-50"
          >
            {busy ? '···' : 'PRESTIGER'}
          </button>
        </div>
      </div>
    </div>
  );
}
