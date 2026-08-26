'use client';

import { X, Sparkles, ArrowDown, ArrowUp, ShieldCheck } from 'lucide-react';
import { PRESTIGE_THRESHOLD, CASINO_STARTING_BALANCE, getPrestigeTitle } from '@/lib/casino/meta';

/**
 * Prestige wipes the balance, and nothing on screen said so before the click.
 * This spells out what goes, what stays, and what you get in exchange.
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
  const nextTitle = getPrestigeTitle(prestigeCount + 1);

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-primary" /> Prestiger
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
            Ton solde repart de <span className="font-black text-tx-base">{CASINO_STARTING_BALANCE.toLocaleString('fr-FR')} ₶</span>.
            Tu en as <span className="font-black text-tx-base">{balance.toLocaleString('fr-FR')} ₶</span> :
            c&apos;est ce que tu abandonnes.
          </p>
        </div>

        <div className="rounded-xl border-2 border-accent-success bg-accent-success/10 p-3 mb-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp className="h-4 w-4 text-accent-success" />
            <span className="font-display font-black text-xs uppercase tracking-widest text-accent-success">Ce que tu gagnes</span>
          </div>
          <ul className="text-sm text-tx-secondary leading-snug space-y-1">
            <li>Le titre <span className="font-black text-accent-primary">{nextTitle}</span>, affiché sous ton pseudo.</li>
            <li>Un prestige de plus au compteur, qui débloque les succès de prestige.</li>
          </ul>
        </div>

        <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-tx-secondary" />
            <span className="font-display font-black text-xs uppercase tracking-widest text-tx-muted">Ce que tu gardes</span>
          </div>
          <p className="text-sm text-tx-secondary leading-snug">
            Niveau et XP, succès, cosmétiques, inventaire, Frenly Pass, statistiques et records.
            Seul le solde est remis à zéro.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-13 py-3 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base transition-colors focus:outline-none"
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
