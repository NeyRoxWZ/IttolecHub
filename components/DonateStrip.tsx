'use client';

import { useEffect, useState } from 'react';
import { Heart, ArrowUpRight, X, Copy, Check } from 'lucide-react';
import { DONATE_URL } from '@/lib/donate';
import { DonorBadge } from '@/components/OgName';

/**
 * One slim line asking for support, under the games of the home page. Never a
 * pop-up on its own and never in the way: players who don't care scroll past
 * it. "Faire un don" opens a short card that says everything in three lines.
 */
export default function DonateStrip({ text, pseudo }: { text: string; pseudo?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!DONATE_URL) return null;

  return (
    <>
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-[18px] border-[3px] border-brand-border px-4 py-3 bg-[linear-gradient(100deg,#3A1D5E_0%,#5B2266_55%,#6E2459_100%)] shadow-[0_5px_0_#05061A]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-accent-secondary flex items-center justify-center shadow-[inset_0_-4px_0_#C92D63] donate-beat">
            <Heart className="h-5 w-5 text-white" fill="currentColor" />
          </span>
          <p className="text-sm font-bold text-[#F4D6F0] leading-snug">
            <span className="font-display text-base text-white">ItollecHub est gratuit.</span> {text}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-lg shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A] active:translate-y-[2px] transition-transform"
        >
          <Heart className="h-4 w-4" fill="currentColor" /> Faire un don
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
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-[22px] border-4 border-brand-border bg-brand-card shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
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

        <ol className="p-5 space-y-3">
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
              Quelque temps après, tu reçois le <span className="text-white">badge Donateur</span> <DonorBadge className="ml-0.5 text-[15px]" /> sur ton compte.
            </p>
          </li>
        </ol>

        <div className="px-5 pb-5">
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
