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
    <div className="fixed inset-0 z-[200] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-3xl leading-none flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-primary" /> Prestige {next}
            </h2>
            <p className="text-xs font-black text-accent-secondary mt-2">Irréversible. Lis avant de valider.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-secondary text-white font-display text-sm"><ArrowDown className="h-4 w-4" />Ce que tu perds</span>
          </div>
          <p className="text-sm text-tx-secondary leading-snug">
            Ton solde repart de <span className="font-black text-tx-base">{CASINO_STARTING_BALANCE.toLocaleString('en-US')} ₶</span>.
            Tu en as <span className="font-black text-tx-base">{balance.toLocaleString('en-US')} ₶</span> :
            c&apos;est ce que tu abandonnes.
          </p>
        </div>

        {/* The exclusive piece, previewed with the artwork it will actually use. */}
        {cosmetic && (
          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-sm"><Sparkles className="h-4 w-4" />Cosmétique exclusif</span>
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

        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-success text-brand-bg font-display text-sm"><TrendingUp className="h-4 w-4" />Bonus permanent</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl text-accent-success tabular-nums">
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

        <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border-2 border-brand-border bg-[#2B3170] text-white font-display text-sm"><ShieldCheck className="h-4 w-4" />Le reste</span>
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
            className="flex-1 h-14 text-xl rounded-2xl border-[3px] border-brand-border bg-[#2B3170] text-white font-display shadow-[inset_0_-5px_0_#1A1F52,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || balance < PRESTIGE_THRESHOLD}
            className="flex-[1.4] h-14 text-2xl rounded-2xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none disabled:opacity-50"
          >
            {busy ? '···' : 'Prestiger'}
          </button>
        </div>
      </div>
    </div>
  );
}
