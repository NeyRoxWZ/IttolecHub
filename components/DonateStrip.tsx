'use client';

import { useEffect, useState } from 'react';
import { Heart, ArrowUpRight, X, Copy, Check } from 'lucide-react';
import { DONATE_URL } from '@/lib/donate';
import { DonorBadge } from '@/components/OgName';
import { cn } from '@/lib/utils';

/**
 * A compact support block that lives inside an existing card of the home page
 * (the patch notes column in solo, the "Comment jouer" card in multiplayer):
 * it never adds height to the page, so the page never scrolls because of it.
 * "Faire un don" opens a short card that says everything in three lines.
 */
export default function DonateStrip({ text, pseudo, className }: { text: string; pseudo?: string | null; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!DONATE_URL) return null;

  return (
    <>
      <div className={cn('shrink-0 flex items-center gap-3 rounded-[18px] border-[3px] border-brand-border px-3 py-2.5 bg-[linear-gradient(100deg,#3A1D5E_0%,#5B2266_55%,#6E2459_100%)] shadow-[0_4px_0_#05061A]', className)}>
        <span className="h-10 w-10 shrink-0 rounded-xl border-[3px] border-brand-border bg-accent-secondary flex items-center justify-center shadow-[inset_0_-4px_0_#C92D63] donate-beat">
          <Heart className="h-5 w-5 text-white" fill="currentColor" />
        </span>
        <p className="min-w-0 flex-1 text-[12px] font-bold text-[#F4D6F0] leading-tight">
          <span className="block font-display text-base text-white leading-tight">Soutiens le site</span>
          {text}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-base shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A] active:translate-y-[2px] transition-transform"
        >
          Faire un don
        </button>
      </div>
      {open && <DonateCard pseudo={pseudo} onClose={() => setOpen(false)} />}
    </>
  );
}

function DonateCard({ pseudo, onClose }: { pseudo?: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    if (!pseudo) return;
    try { await navigator.clipboard.writeText(pseudo); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="fixed inset-0 z-[300] bg-[#05061A]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-title"
        className="w-full max-w-sm max-h-[92dvh] overflow-y-auto rounded-[22px] border-4 border-brand-border bg-brand-card shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4 border-b-4 border-brand-border bg-[linear-gradient(135deg,#FF4F8B_0%,#B43FD1_60%,#6E3BE8_100%)] rounded-t-[18px]">
          <button onClick={onClose} aria-label="Fermer" className="absolute top-3 right-3 h-10 w-10 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
          <span className="h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-white flex items-center justify-center shadow-[inset_0_-4px_0_#E3D6F5,0_4px_0_#05061A]">
            <Heart className="h-8 w-8 text-accent-secondary" fill="currentColor" />
          </span>
          <h2 id="donate-title" className="mt-3 font-display text-3xl leading-none text-white text-stroke-sm">Soutiens ItollecHub</h2>
          <p className="mt-1 text-sm font-bold text-white/90">Ton don paie les serveurs et les nouveaux jeux.</p>
        </div>

        {/* What the player gets, shown with their own name before they give. */}
        <div className="px-5 pt-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted mb-1.5">Ton pseudo après ton don</div>
          <div className="flex items-center gap-3 rounded-2xl border-[3px] border-brand-border bg-brand-inner px-3 py-2.5 shadow-[inset_0_3px_0_#0B0E2A]">
            <span className="h-9 w-9 shrink-0 rounded-xl bg-accent-secondary text-white font-display text-lg flex items-center justify-center shadow-[inset_0_-3px_0_#C92D63]">
              {(pseudo || 'T')[0]?.toUpperCase()}
            </span>
            <span className="og-wrap min-w-0 font-display text-xl">
              <span className="donor-name truncate">{pseudo || 'TonPseudo'}</span>
              <DonorBadge />
            </span>
          </div>
        </div>

        <ol className="px-5 pt-4 space-y-3">
          <li className="flex gap-3 items-start">
            <span className="h-7 w-7 shrink-0 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display flex items-center justify-center">1</span>
            <p className="text-sm font-bold text-tx-secondary leading-snug"><span className="text-white">Donne ce que tu veux</span>, il n’y a pas de minimum.</p>
          </li>
          <li className="flex gap-3 items-start">
            <span className="h-7 w-7 shrink-0 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display flex items-center justify-center">2</span>
            <div className="min-w-0 text-sm font-bold text-tx-secondary leading-snug">
              <p>Écris <span className="text-white">ton pseudo exact</span> dans la note du don.</p>
              {pseudo && (
                <button onClick={copy} className="mt-1.5 max-w-full inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border-2 border-brand-border bg-brand-inner font-display text-sm text-white">
                  <span className="truncate">{pseudo}</span>
                  {copied ? <Check className="h-3.5 w-3.5 text-accent-success shrink-0" /> : <Copy className="h-3.5 w-3.5 text-tx-secondary shrink-0" />}
                </button>
              )}
            </div>
          </li>
          <li className="flex gap-3 items-start">
            <span className="h-7 w-7 shrink-0 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display flex items-center justify-center">3</span>
            <p className="text-sm font-bold text-tx-secondary leading-snug">
              Quelque temps après, ton pseudo passe en <span className="text-white">rose avec le badge Donateur</span>, partout sur le site.
            </p>
          </li>
        </ol>

        <div className="p-5">
          <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-14 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-[#FFC439] text-[#003087] font-display text-xl shadow-[inset_0_-5px_0_#E0A41A,0_4px_0_#05061A] active:translate-y-[3px] transition-transform"
          >
            Donner avec PayPal <ArrowUpRight className="h-5 w-5" />
          </a>
          <p className="mt-2 text-center text-[11px] font-bold text-tx-muted">Uniquement PayPal pour l’instant.</p>
        </div>
      </div>
    </div>
  );
}
