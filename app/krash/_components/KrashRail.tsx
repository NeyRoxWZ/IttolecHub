'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Gift, LifeBuoy, Package, Sparkles, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { KRASH_REFILL_AMOUNT } from '@/lib/krash/assets';
import { ClaimTile, Group, NavTile, type Claim } from '@/app/casino/_components/CasinoRail';
import PushToggle from '@/app/casino/_components/PushToggle';
import type { MenuEntry } from '@/app/casino/_components/CasinoMenu';
import { useKrashProgression } from '../_lib/useKrashProgression';
import { useKrashWallet } from '../_lib/useKrashWallet';
import KrashChestModal from './KrashChestModal';
import KrashMissionsModal from './KrashMissionsModal';

/**
 * Krash's rail, built from the casino's own tiles so the two games read the
 * same way: what can be collected, where to go, what is happening. A tile
 * either opens a modal (chest, missions) or leads to a page (placements,
 * pass, inventory, leaderboard) — never both.
 */
export default function KrashRail({ openPositions, className }: { openPositions: number; className?: string }) {
  const router = useRouter();
  const wallet = useKrashWallet();
  const { progression: p } = useKrashProgression();
  const [modal, setModal] = useState<'chest' | 'missions' | null>(null);

  const missionsReady = p?.missions.filter((m) => m.done && !m.claimed).length ?? 0;
  const tiersReady = p ? Array.from({ length: p.pass.tier }, (_, i) => i + 1).filter((t) => !p.pass.claimed.includes(t)).length : 0;

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
  const destinations: MenuEntry[] = [
    { label: 'Missions', icon: Target, hint: 'Trois missions par jour', pending: missionsReady, onSelect: () => { sfx.click(); setModal('missions'); } },
    { label: 'Placements', icon: Briefcase, hint: 'Tout ce que tu as placé', pending: openPositions, onSelect: go('/krash/placements') },
    { label: 'Pass Krash', icon: Sparkles, hint: '30 paliers par mois', pending: tiersReady, onSelect: go('/krash/pass') },
    { label: 'Inventaire', icon: Package, hint: 'Titres et couleurs de courbe', onSelect: go('/krash/inventaire') },
    { label: 'Classement', icon: Trophy, hint: 'Les meilleurs traders', onSelect: go('/krash/classement') },
  ] as MenuEntry[];

  return (
    <aside className={cn('space-y-2.5', className)}>
      {modal === 'chest' && <KrashChestModal onClose={() => setModal(null)} />}
      {modal === 'missions' && <KrashMissionsModal onClose={() => setModal(null)} />}

      <Group title="À récupérer">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-1.5">
          {claims.map((c) => <ClaimTile key={c.label} claim={c} />)}
        </div>
      </Group>

      <Group title="Aller à">
        <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-2 gap-1.5">
          {destinations.map((d) => <NavTile key={d.label} entry={d} />)}
        </div>
      </Group>

      <Group title="En ce moment">
        <PushToggle className="w-full justify-center" />
      </Group>
    </aside>
  );
}
