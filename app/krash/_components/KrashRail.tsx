'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Gift, Info, LifeBuoy, Package, ShoppingBag, Sparkles, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { KRASH_REFILL_AMOUNT } from '@/lib/krash/assets';
import { ClaimTile, Group, NavTile, type Claim } from '@/app/casino/_components/CasinoRail';
import PushToggle from '@/app/casino/_components/PushToggle';
import type { MenuEntry } from '@/app/casino/_components/CasinoMenu';
import { useKrashProgression } from '../_lib/useKrashProgression';
import { useKrashWallet } from '../_lib/useKrashWallet';
import { unclaimedCount, useKrashPass } from '../_lib/useKrashPass';
import KrashChestModal from './KrashChestModal';
import KrashMissionsModal from './KrashMissionsModal';
import KrashOnboarding, { ONBOARDING_KEY } from './KrashOnboarding';

/**
 * Krash's rail, built from the casino's own tiles so the two games read the
 * same way: what can be collected, where to go, what is happening. A tile
 * either opens a modal (chest, missions, guide) or leads to a page
 * (placements, pass, shop, inventory, leaderboard) — never both.
 */
export default function KrashRail({ openPositions, className }: { openPositions: number; className?: string }) {
  const router = useRouter();
  const wallet = useKrashWallet();
  const { progression: p } = useKrashProgression();
  const { pass } = useKrashPass(true);
  const [modal, setModal] = useState<'chest' | 'missions' | 'guide' | null>(null);

  const missionsReady = p?.missions.filter((m) => m.done && !m.claimed).length ?? 0;

  const claims: Claim[] = [
    {
      label: 'Coffre',
      icon: Gift,
      ready: !!p?.chest.canClaim,
      readyHint: `+${p?.chest.reward ?? 0} ₶`,
      waitLabel: 'demain',
      onClick: () => { sfx.click(); setModal('chest'); },
    },
    {
      label: 'Renflouer',
      icon: LifeBuoy,
      ready: wallet.canRefill,
      readyHint: `${KRASH_REFILL_AMOUNT} ₶`,
      waitLabel: wallet.refillBlocked === 'cooldown' ? '1×/jour' : 'si à sec',
      onClick: () => { void wallet.refill(); },
    },
  ];

  const go = (href: string) => () => { sfx.click(); router.push(href); };
  const destinations = [
    { label: 'Missions', icon: Target, hint: 'Trois missions par jour', pending: missionsReady, onSelect: () => { sfx.click(); setModal('missions'); } },
    { label: 'Placements', icon: Briefcase, hint: 'Tout ce que tu as placé', pending: openPositions, onSelect: go('/krash/placements') },
    { label: 'Pass Krash', icon: Sparkles, hint: '100 paliers par mois', pending: unclaimedCount(pass), onSelect: go('/krash/pass') },
    { label: 'Boutique', icon: ShoppingBag, hint: 'Objets du jour et caisses', onSelect: go('/krash/boutique') },
    { label: 'Inventaire', icon: Package, hint: 'Objets, caisses et cosmétiques', onSelect: go('/krash/inventaire') },
    { label: 'Classement', icon: Trophy, hint: 'Les meilleurs traders', onSelect: go('/krash/classement') },
    { label: 'Guide', icon: Info, hint: 'Comment jouer', onSelect: () => { sfx.click(); setModal('guide'); } },
  ] as MenuEntry[];

  return (
    <aside className={cn('space-y-2.5', className)}>
      {modal === 'chest' && <KrashChestModal onClose={() => setModal(null)} />}
      {modal === 'missions' && <KrashMissionsModal onClose={() => setModal(null)} />}
      {modal === 'guide' && (
        <KrashOnboarding onClose={() => { setModal(null); try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch {} }} />
      )}

      <Group title="À récupérer">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-1.5">
          {claims.map((c) => <ClaimTile key={c.label} claim={c} />)}
        </div>
      </Group>

      <Group title="Aller à">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-1.5">
          {destinations.map((d) => <NavTile key={d.label} entry={d} />)}
        </div>
      </Group>

      <Group title="En ce moment">
        <PushToggle className="w-full justify-center" />
      </Group>
    </aside>
  );
}
