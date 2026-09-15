import { Heart, ArrowUpRight } from 'lucide-react';
import { DONATE_URL } from '@/lib/donate';

/**
 * One slim line asking for support, under the games of the home page. Never a
 * pop-up and never in the way: players who don't care scroll past it.
 */
export default function DonateStrip({ text }: { text: string }) {
  if (!DONATE_URL) return null;
  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-[18px] border-[3px] border-brand-border bg-brand-inner px-4 py-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="h-10 w-10 shrink-0 rounded-xl border-[3px] border-brand-border bg-accent-secondary flex items-center justify-center shadow-[inset_0_-3px_0_#C92D63]">
          <Heart className="h-5 w-5 text-white" fill="currentColor" />
        </span>
        <p className="text-sm font-bold text-tx-secondary leading-snug">
          <span className="font-display text-base text-white">ItollecHub est gratuit.</span> {text}
        </p>
      </div>
      <a
        href={DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white font-display text-lg shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A] active:translate-y-[2px] transition-transform"
      >
        Soutenir <ArrowUpRight className="h-4 w-4" />
      </a>
    </div>
  );
}
