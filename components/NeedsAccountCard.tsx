'use client';

import { Lock } from 'lucide-react';
import { askToSignIn } from '@/lib/askToSignIn';
import { cn } from '@/lib/utils';

/**
 * In place of a panel a guest can't use (inventory, achievements, friends):
 * says what it's for and opens the sign-in prompt, instead of an empty page.
 */
export default function NeedsAccountCard({ title, text, reason, className }: {
  title: string; text: string; reason: string; className?: string;
}) {
  return (
    <div className={cn('rounded-[22px] border-4 border-brand-border bg-brand-card p-6 text-center shadow-[0_6px_0_#05061A]', className)}>
      <span className="mx-auto h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]">
        <Lock className="h-7 w-7 text-brand-bg" strokeWidth={2.5} />
      </span>
      <h2 className="mt-3 font-display text-2xl leading-tight">{title}</h2>
      <p className="mt-1 text-sm font-bold text-tx-secondary">{text}</p>
      <button
        type="button"
        onClick={() => askToSignIn(reason)}
        className="mt-4 h-12 px-5 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-lg shadow-[inset_0_-5px_0_#D98E00,0_4px_0_#05061A] active:translate-y-[3px] transition-transform"
      >
        Se connecter
      </button>
    </div>
  );
}
