'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { setNavBadges } from '@/lib/casino/appNav';
import { MissionsBody, useMissions } from '../_components/MissionsModal';
import { useCommunity } from '../_components/CommunityQuest';

/**
 * Missions as a page of its own, reached from the tab bar on phones — next to
 * the Pass and the Shop, which are pages too. The desktop hub keeps its modal.
 */
export default function MissionsPage() {
  const { missions, reload, claimable } = useMissions();
  const { refresh } = useCasinoWallet();
  const { state: community } = useCommunity();
  const communityClaimable = community?.completed && community.you && !community.you.claimed && community.you.reward > 0 ? 1 : 0;

  useEffect(() => { setNavBadges({ missions: claimable + communityClaimable }); }, [claimable, communityClaimable]);

  return (
    <main className="min-h-[100dvh] bg-transparent text-tx-base px-3 sm:px-6 pt-3 sm:pt-5 pb-10">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center gap-3 mb-4">
          <Link
            href="/casino"
            prefetch
            aria-label="Retour au casino"
            className="h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-xl border-[3px] border-brand-border bg-accent-secondary text-white shadow-[inset_0_-5px_0_#C92D63,0_4px_0_#05061A] active:translate-y-[3px] transition-transform focus:outline-none"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Missions</h1>
            <span className="text-[11px] text-tx-muted">Trois horloges, trois listes, et l’objectif commun.</span>
          </div>
        </header>

        <div className="bg-brand-card border-4 border-brand-border rounded-[22px] p-4 sm:p-6 shadow-[0_8px_0_#05061A]">
          <MissionsBody missions={missions} onClaimed={() => { void reload(); void refresh(); }} />
        </div>
      </div>
    </main>
  );
}
