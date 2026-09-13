'use client';

import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { isOwner } from '@/lib/owner';
import PecheGame from './_components/PecheGame';

/**
 * Frenly Pêche — under construction. Everyone else gets the construction
 * notice; the owner's account (by id, so a rename keeps access) gets the game.
 */
export default function PechePage() {
  const { user, loading } = useAuth();
  const allowed = !loading && isOwner(user?.id);

  return (
    <main className="min-h-[100dvh] bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10">
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="h-[520px] rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />
        ) : allowed && user ? (
          <PecheGame userId={user.id} />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <Link
                href="/?mode=solo"
                aria-label="Retour"
                className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={3} />
              </Link>
              <h1 className="font-display text-3xl sm:text-4xl leading-none">Frenly Pêche</h1>
            </div>
            <div className="max-w-xl mx-auto mt-10 bg-brand-card border-4 border-brand-border rounded-[22px] p-8 text-center shadow-[0_8px_0_#05061A]">
              <span className="mx-auto mb-4 h-16 w-16 rounded-2xl border-[3px] border-brand-border bg-accent-primary flex items-center justify-center shadow-[inset_0_-5px_0_#D98E00]">
                <Construction className="h-9 w-9 text-brand-bg" />
              </span>
              <h2 className="font-display text-3xl">En construction</h2>
              <p className="mt-2 text-sm font-bold text-tx-secondary">Le jeu arrive bientôt. Reviens nous voir !</p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
