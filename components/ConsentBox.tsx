'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Set just before a Discord sign-up, so the account can be created on return. */
export const DISCORD_CONSENT_KEY = 'itollec_discord_consent';

/** The box to tick before an account is created, by passphrase or by Discord. */
export default function ConsentBox({
  checked, onChange, minorNote = false,
}: { checked: boolean; onChange: (value: boolean) => void; minorNote?: boolean }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border-[3px] border-brand-border bg-brand-inner p-3 hover:border-tx-base transition-colors">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 h-6 w-6 shrink-0 rounded-md border-[3px] flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-tx-base',
          checked ? 'bg-accent-success border-accent-success text-brand-bg' : 'border-brand-border bg-brand-card'
        )}
      >
        {checked && <Check className="h-4 w-4" strokeWidth={3} />}
      </span>
      <span className="text-[13px] text-tx-secondary leading-snug">
        J&apos;ai lu et j&apos;accepte les{' '}
        <a href="/conditions" target="_blank" className="underline text-tx-base hover:text-accent-primary">Conditions d&apos;utilisation</a> et la{' '}
        <a href="/confidentialite" target="_blank" className="underline text-tx-base hover:text-accent-primary">politique de confidentialité</a>.
        {minorNote && <> Si j&apos;ai moins de 15 ans, un parent est d&apos;accord.</>}
      </span>
    </label>
  );
}
