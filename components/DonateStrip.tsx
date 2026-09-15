'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Heart, X, Copy, Check } from 'lucide-react';
import { DONATE_URL } from '@/lib/donate';
import { DonorBadge } from '@/components/OgName';
import { cn } from '@/lib/utils';

/**
 * The donate button: in the home page's top bar, left of the profile (and on
 * the profile when a player has no badge). Its heart beats; hovering it sends
 * a sweep of light across every two seconds. It opens a short card that says
 * everything in three lines.
 */
export default function DonateButton({ pseudo, avatarUrl, compact, iconOnly, label = 'Don', className }: {
  pseudo?: string | null; avatarUrl?: string | null; compact?: boolean; iconOnly?: boolean; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!DONATE_URL) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? 'Faire un don' : undefined}
        title="Faire un don"
        className={cn(
          'donate-sweep relative overflow-hidden shrink-0 inline-flex items-center gap-2 rounded-[18px] border-[3px] border-brand-border text-white font-display whitespace-nowrap transition-transform active:translate-y-[3px]',
          'bg-[linear-gradient(135deg,#FF4F8B_0%,#C43FD1_100%)] shadow-[inset_0_-4px_0_rgba(90,20,80,0.55),0_4px_0_#05061A]',
          iconOnly ? 'h-12 w-12 justify-center' : compact ? 'h-11 pl-1.5 pr-3 text-base' : 'h-12 pl-1.5 pr-4 text-lg',
          className,
        )}
      >
        <span className="donate-beat h-8 w-8 shrink-0 rounded-xl border-2 border-brand-border bg-white flex items-center justify-center">
          <Heart className="h-[18px] w-[18px] text-accent-secondary" fill="currentColor" />
        </span>
        {!iconOnly && <span className="leading-none">{label}</span>}
      </button>
      {open && <DonateModal pseudo={pseudo} avatarUrl={avatarUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

/** PayPal's mark and wordmark in PayPal's own blues, so the button reads as the real thing. */
function PayPalLogo() {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label="PayPal">
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path
          fill="#003087"
          d="M7.016 19.198h-4.2a.562.562 0 0 1-.555-.65L5.093.584A.692.692 0 0 1 5.776 0h7.222c3.417 0 5.904 2.488 5.846 5.5-.006.25-.027.5-.066.747A6.794 6.794 0 0 1 12.071 12H8.743a.69.69 0 0 0-.682.583l-.325 2.056-.013.083-.692 4.39-.015.087zM19.79 6.142c-.01.087-.01.175-.023.261a7.76 7.76 0 0 1-7.695 6.598H9.007l-.283 1.795-.013.083-.692 4.39-.134.843-.014.088H6.86l-.497 3.15a.562.562 0 0 0 .555.65h3.612c.34 0 .63-.249.683-.585l.952-6.031a.692.692 0 0 1 .683-.584h2.126a6.793 6.793 0 0 0 6.707-5.752c.306-1.95-.466-3.744-1.89-4.906z"
        />
      </svg>
      <span aria-hidden="true" className="text-[22px] font-bold italic leading-none tracking-tight" style={{ fontFamily: 'Verdana, Arial, sans-serif' }}>
        <span className="text-[#003087]">Pay</span><span className="text-[#0079C1]">Pal</span>
      </span>
    </span>
  );
}

export function DonateModal({ pseudo, avatarUrl, onClose }: { pseudo?: string | null; avatarUrl?: string | null; onClose: () => void }) {
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

        {/* What the player gets, shown with their own name and picture before they give. */}
        <div className="px-5 pt-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted mb-1.5">Ton pseudo après ton don</div>
          <div className="flex items-center gap-3 rounded-2xl border-[3px] border-brand-border bg-brand-inner px-3 py-2.5 shadow-[inset_0_3px_0_#0B0E2A]">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-full border-2 border-brand-border object-cover" />
            ) : (
              <span className="h-9 w-9 shrink-0 rounded-xl bg-accent-secondary text-white font-display text-lg flex items-center justify-center shadow-[inset_0_-3px_0_#C92D63]">
                {(pseudo || 'T')[0]?.toUpperCase()}
              </span>
            )}
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
            className="w-full h-14 inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-brand-border bg-[#FFC439] text-[#003087] font-display text-lg shadow-[inset_0_-5px_0_#E0A41A,0_4px_0_#05061A] active:translate-y-[3px] transition-transform"
          >
            Donner avec <PayPalLogo />
          </a>
          <p className="mt-2 text-center text-[11px] font-bold text-tx-muted">Uniquement PayPal pour l’instant.</p>
        </div>
      </div>
    </div>
  );
}
